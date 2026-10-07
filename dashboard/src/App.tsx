import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine, ArrowRight, Bell, Check, ChevronDown, CircleHelp, FileText,
  Filter, GitBranch, Inbox, Layers3, LayoutDashboard, Menu, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings2, Sparkles, Tag, Trash2, Upload, X,
} from 'lucide-react';
import { analyze, exportRoadmap, parseInput, SAMPLE_SIGNALS, type Lane, type Signal, type Source, type Theme, type Workspace } from './analysis';

type View = 'overview' | 'signals' | 'issues' | 'roadmap';
const STORAGE_KEY = 'signal-to-roadmap-workspace-v1';
const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4';
const EMPTY: Workspace = { signals: [], names: {}, lanes: {}, hidden: [] };

function initialWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace;
      if (Array.isArray(parsed.signals) && parsed.names && parsed.lanes && Array.isArray(parsed.hidden)) return parsed;
    }
  } catch { /* Fall back to sample workspace. */ }
  return { ...EMPTY, signals: SAMPLE_SIGNALS };
}

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string, fallback: Source): Omit<Signal, 'id' | 'createdAt'>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const hasHeader = headers.some((value) => ['text', 'content', 'body', 'description', 'signal'].includes(value));
  const textIndex = hasHeader ? Math.max(0, headers.findIndex((value) => ['text', 'content', 'body', 'description', 'signal'].includes(value))) : 0;
  const sourceIndex = hasHeader ? headers.findIndex((value) => ['source', 'source_type', 'type'].includes(value)) : -1;
  const accountIndex = hasHeader ? headers.findIndex((value) => ['account', 'customer', 'company'].includes(value)) : -1;
  return rows.slice(hasHeader ? 1 : 0).map((cells) => {
    const raw = sourceIndex >= 0 ? (cells[sourceIndex] || '').toLowerCase() : '';
    const source: Source = /support|ticket/.test(raw) ? 'support' : /review/.test(raw) ? 'review' : /note|sales/.test(raw) ? 'note' : fallback;
    return { text: (cells[textIndex] || '').trim(), source, account: accountIndex >= 0 ? cells[accountIndex]?.trim() : undefined };
  }).filter((item) => item.text.length >= 8);
}

function sourceLabel(source: Source) { return source === 'support' ? 'Support' : source === 'note' ? 'Notes' : 'Reviews'; }
function initials(text: string) { return text.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [inputSource, setInputSource] = useState<Source>('support');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const themes = useMemo(() => analyze(workspace), [workspace]);
  const selected = themes.find((theme) => theme.id === selectedId) || null;
  const filteredSignals = workspace.signals.filter((signal) =>
    (sourceFilter === 'all' || signal.source === sourceFilter) &&
    (!query || `${signal.text} ${signal.account || ''}`.toLowerCase().includes(query.toLowerCase())));
  const totalSources = new Set(workspace.signals.map((signal) => signal.source)).size;
  const urgentIssues = themes.filter((theme) => theme.lane === 'Now').length;
  const isSample = workspace.signals.some((signal) => signal.id.startsWith('sample-'));

  function update(next: Workspace) {
    setWorkspace(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setNotice('Browser storage is full; this session will not persist.'); }
  }
  function addSignals(items: Omit<Signal, 'id' | 'createdAt'>[]) {
    const existing = new Set(workspace.signals.map((signal) => `${signal.source}:${signal.text.toLowerCase()}`));
    const unique = items.filter((item) => !existing.has(`${item.source}:${item.text.toLowerCase()}`));
    if (!unique.length) { setNotice('No new signals found. Check for duplicates or shorter entries.'); return; }
    update({ ...workspace, signals: [...workspace.signals, ...unique.map((item) => ({ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }))] });
    setRawInput(''); setComposer(false); setView('issues');
    setNotice(`${unique.length} ${unique.length === 1 ? 'signal' : 'signals'} added and grouped.`);
  }
  async function onFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setNotice('Upload a .csv or .txt file.'); return; }
    const text = await file.text();
    addSignals(/\.csv$/i.test(file.name) ? parseCsv(text, inputSource) : parseInput(text, inputSource));
    if (fileInput.current) fileInput.current.value = '';
  }
  function renameTheme(theme: Theme) {
    const value = window.prompt('Name this issue', theme.name)?.trim();
    if (value) update({ ...workspace, names: { ...workspace.names, [theme.id]: value.slice(0, 80) } });
  }
  function setLane(theme: Theme, lane: Lane) { update({ ...workspace, lanes: { ...workspace.lanes, [theme.id]: lane } }); }
  function hideTheme(theme: Theme) { update({ ...workspace, hidden: [...workspace.hidden, theme.id] }); setSelectedId(null); }
  function resetWorkspace() {
    if (!window.confirm('Replace this local workspace with the sample data? Export your work first if you want to keep it.')) return;
    update({ ...EMPTY, signals: SAMPLE_SIGNALS }); setSelectedId(null); setView('overview'); setNotice('Sample workspace restored.');
  }
  function newWorkspace() {
    if (workspace.signals.length && !window.confirm('Start a blank local workspace? Export your work first if you want to keep it.')) return;
    update(EMPTY); setSelectedId(null); setView('overview'); setNotice('Blank workspace ready.');
  }

  const nav: { id: View; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'signals', label: 'Signal inbox', icon: Inbox, count: workspace.signals.length },
    { id: 'issues', label: 'Issue themes', icon: Layers3, count: themes.length },
    { id: 'roadmap', label: 'Draft roadmap', icon: GitBranch },
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✦</span><span>Signal<span className="brand-light"> to Roadmap</span></span></div>
      <nav className="top-links" aria-label="Primary"><button onClick={() => setView('overview')}>Home</button><button onClick={() => setView('issues')}>Issues</button><button onClick={() => setView('roadmap')}>Roadmap</button></nav>
      <div className="top-actions"><span className="local-pill"><span className="live-dot" /> Local workspace</span><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={19}/></button><button className="top-cta" onClick={() => setComposer(true)}><Plus size={15}/> Add signals</button></div>
    </header>

    <section className="hero" aria-label="Product introduction">
      <video aria-hidden="true" className="hero-video" src={VIDEO_URL} autoPlay muted loop playsInline preload="none" />
      <div className="hero-wash" />
      <motion.div className="hero-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <span className="hero-badge"><Sparkles size={13}/> The customer voice, made actionable</span>
        <h1>Find the <em>pattern.</em> Build the right thing.</h1>
        <p>Bring support tickets, sales notes, and reviews into one place. See recurring issues, inspect the evidence, and shape a roadmap your team can challenge.</p>
      </motion.div>
    </section>

    <motion.div className="dashboard-frame" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6 }}>
      <div className="dashboard">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="sidebar-top"><span className="workspace-icon">S</span><span><strong>Product workspace</strong><small>{isSample ? 'Sample data' : 'Your local data'}</small></span><ChevronDown size={14}/></div>
          <div className="sidebar-label">WORKSPACE</div>
          <nav aria-label="Workspace views">{nav.map((item) => <button key={item.id} className={`side-link ${view === item.id ? 'active' : ''}`} onClick={() => { setView(item.id); setMobileNav(false); }}><item.icon size={16}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}</button>)}</nav>
          <div className="sidebar-label sidebar-label-later">SOURCES</div>
          <div className="source-list"><span><i className="source-dot support"/>Support tickets</span><span><i className="source-dot note"/>Sales & team notes</span><span><i className="source-dot review"/>Product reviews</span></div>
          <div className="sidebar-bottom"><button onClick={newWorkspace}><Plus size={15}/> New workspace</button><button onClick={resetWorkspace}><Settings2 size={15}/> Reset sample</button><div className="privacy-note"><CircleHelp size={15}/> Your inputs stay in this browser.</div></div>
        </aside>

        <main className="workspace-main">
          <div className="workspace-toolbar"><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{nav.find((item) => item.id === view)?.label}</strong></div><div className="toolbar-actions"><span className="draft-tag">DRAFT ANALYSIS</span><button className="icon-button" title="Add signals" onClick={() => setComposer(true)}><Plus size={17}/></button><button className="icon-button" title="Export roadmap" onClick={() => download('signal-to-roadmap.md', exportRoadmap(themes, workspace.signals), 'text/markdown')}><ArrowDownToLine size={16}/></button><span className="avatar">PH</span></div></div>
          <div className="workspace-scroll">
            {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14}/></button></div>}
            {view === 'overview' && <>
              <div className="section-heading"><div><span className="eyebrow">GOOD MORNING, PRODUCT TEAM</span><h2>What customers are telling you.</h2><p>Recurring patterns are grouped below. Open any issue to trace it back to the original words.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add customer signals</button></div>
              <div className="stat-grid"><Stat label="Signals collected" value={workspace.signals.length} icon={<MessageSquareText size={17}/>} sub="Distinct input records"/><Stat label="Issue themes" value={themes.length} icon={<Layers3 size={17}/>} sub="Grouped by shared language"/><Stat label="Sources represented" value={totalSources} icon={<Inbox size={17}/>} sub="Support, notes, reviews"/><Stat label="Now candidates" value={urgentIssues} icon={<GitBranch size={17}/>} sub="Review before commitment"/></div>
              <div className="content-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">ISSUE RADAR</span><h3>Most repeated issues</h3></div><button className="text-button" onClick={() => setView('issues')}>All issues <ArrowRight size={14}/></button></div>{themes.length ? themes.slice(0, 5).map((theme) => <IssueRow key={theme.id} theme={theme} onClick={() => { setSelectedId(theme.id); setView('issues'); }}/>) : <Empty text="Add a few customer signals to see patterns emerge." onAction={() => setComposer(true)}/>}</div><div className="panel source-panel"><div className="panel-heading"><div><span className="eyebrow">SOURCE MIX</span><h3>Where the evidence comes from</h3></div><MoreHorizontal size={17}/></div><SourceMix signals={workspace.signals}/><div className="insight-box"><Sparkles size={17}/><div><strong>Count signals, then inspect context.</strong><p>One loud customer can submit many tickets. These are input counts, not unique customers.</p></div></div><button className="outline-button wide" onClick={() => setView('roadmap')}>Review draft roadmap <ArrowRight size={15}/></button></div></div>
            </>}
            {view === 'signals' && <><div className="section-heading"><div><span className="eyebrow">UNSTRUCTURED INPUT, ORGANIZED</span><h2>Signal inbox</h2><p>Every source stays visible so a theme can always be traced back to evidence.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add signals</button></div><div className="panel"><div className="filterbar"><label className="searchbox"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signals" aria-label="Search signals"/></label><label className="select-wrap"><Filter size={15}/><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as Source | 'all')} aria-label="Filter source"><option value="all">All sources</option><option value="support">Support</option><option value="note">Notes</option><option value="review">Reviews</option></select></label><span className="result-count">{filteredSignals.length} shown</span></div><div className="signal-list">{filteredSignals.length ? filteredSignals.map((signal) => <div className="signal-row" key={signal.id}><span className={`source-chip ${signal.source}`}>{sourceLabel(signal.source)}</span><div><p>{signal.text}</p><small>{signal.account ? `${signal.account} · ` : ''}{new Date(signal.createdAt).toLocaleDateString()}</small></div><button title="Remove signal" aria-label={`Remove signal: ${signal.text}`} onClick={() => update({ ...workspace, signals: workspace.signals.filter((item) => item.id !== signal.id) })}><Trash2 size={15}/></button></div>) : <Empty text="No signals match your filter." onAction={() => setComposer(true)}/>}</div></div></>}
            {view === 'issues' && <><div className="section-heading"><div><span className="eyebrow">PATTERNS, NOT ANECDOTES</span><h2>Issue themes</h2><p>Each theme has a repeat count, source mix, and inspectable evidence. Rename or set its roadmap lane.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add signals</button></div><div className="issue-layout"><div className="panel issue-table"><div className="table-head"><span>ISSUE THEME</span><span>REPEATS</span><span>PRIORITY</span><span>LANE</span></div>{themes.length ? themes.map((theme) => <button key={theme.id} className={`theme-row ${selected?.id === theme.id ? 'selected' : ''}`} onClick={() => setSelectedId(theme.id)}><span className="theme-name"><span className="theme-avatar">{initials(theme.name)}</span><span><strong>{theme.name}</strong><small>{theme.sources.map(sourceLabel).join(' · ')}</small></span></span><span className="repeat-count">{theme.signalIds.length}<small>signals</small></span><span className="priority"><b>{theme.score}</b><span className="score-track"><i style={{ width: `${theme.score}%` }}/></span></span><span className={`lane-pill lane-${theme.lane.toLowerCase()}`}>{theme.lane}</span></button>) : <Empty text="No issue themes yet. Add customer signals to get started." onAction={() => setComposer(true)}/>}</div><div className="panel detail-panel"><ThemeDetail theme={selected || themes[0] || null} signals={workspace.signals} onRename={renameTheme} onLane={setLane} onHide={hideTheme}/></div></div>{workspace.hidden.length > 0 && <button className="restore-button" onClick={() => update({ ...workspace, hidden: [] })}>Restore {workspace.hidden.length} hidden {workspace.hidden.length === 1 ? 'theme' : 'themes'}</button>}</>}
            {view === 'roadmap' && <><div className="section-heading"><div><span className="eyebrow">A DECISION AID, NOT AN AUTO-PUBLISHED PLAN</span><h2>Draft roadmap</h2><p>Move initiatives between lanes after reviewing evidence, effort, dependencies, and strategy.</p></div><button className="outline-button" onClick={() => download('signal-to-roadmap.md', exportRoadmap(themes, workspace.signals), 'text/markdown')}><ArrowDownToLine size={15}/> Export draft</button></div><div className="roadmap-grid">{(['Now', 'Next', 'Later'] as Lane[]).map((lane) => <div className="roadmap-column" key={lane}><div className="lane-header"><span className={`lane-dot lane-${lane.toLowerCase()}`}/><h3>{lane}</h3><span>{themes.filter((theme) => theme.lane === lane).length}</span></div>{themes.filter((theme) => theme.lane === lane).map((theme) => <div className="roadmap-card" key={theme.id}><div className="roadmap-card-top"><span className="mini-tag">{theme.confidence} confidence</span><b>{theme.score}/100</b></div><h4>{theme.initiative}</h4><div className="addresses">Addresses: {theme.name}</div><p>{theme.rationale}</p><div className="roadmap-card-bottom"><span><MessageSquareText size={13}/>{theme.signalIds.length} signals</span><select aria-label={`Move ${theme.name} to lane`} value={theme.lane} onChange={(event) => setLane(theme, event.target.value as Lane)}><option>Now</option><option>Next</option><option>Later</option></select></div><button className="evidence-link" onClick={() => { setSelectedId(theme.id); setView('issues'); }}>See evidence <ArrowRight size={13}/></button></div>)}{themes.every((theme) => theme.lane !== lane) && <div className="empty-lane">No issues in this lane</div>}</div>)}</div><p className="roadmap-footnote">Initiative titles are hypotheses. Scores combine repeat frequency, source diversity, and language suggesting blocking or failed workflows. They do not account for unique customers, revenue, effort, or strategic fit.</p></>}
          </div>
        </main>
      </div>
    </motion.div>

    {composer && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(false); }}><div className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title"><div className="composer-header"><div><span className="eyebrow">BRING THE MESSY INPUT</span><h2 id="composer-title">Add customer signals</h2></div><button className="icon-button" aria-label="Close" onClick={() => setComposer(false)}><X size={18}/></button></div><p>Paste one ticket, note, or review per line. You can mix sources with prefixes like <code>support:</code>, <code>note:</code>, and <code>review:</code>.</p><label className="field-label" htmlFor="source">Default source</label><select id="source" className="source-select" value={inputSource} onChange={(event) => setInputSource(event.target.value as Source)}><option value="support">Support ticket</option><option value="note">Sales or team note</option><option value="review">Product review</option></select><label className="field-label" htmlFor="signal-text">Customer words</label><textarea id="signal-text" value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'support: The integration keeps disconnecting after a sync.\nnote: A buyer asked for clearer setup instructions.\nreview: Reports are useful but CSV export is slow.'}/><div className="composer-bottom"><input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(event) => onFile(event.target.files?.[0])}/><button className="outline-button" onClick={() => fileInput.current?.click()}><Upload size={15}/> Upload CSV or TXT</button><button className="solid-button" onClick={() => addSignals(parseInput(rawInput, inputSource))} disabled={!rawInput.trim()}><Sparkles size={15}/> Group signals</button></div><small className="helper">CSV columns: text/content, optional source and account. Analysis happens in your browser; no API key is needed.</small></div></div>}
  </div>;
}

function Stat({ label, value, icon, sub }: { label: string; value: number; icon: React.ReactNode; sub: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{sub}</small></div>; }
function Empty({ text, onAction }: { text: string; onAction: () => void }) { return <div className="empty-state"><FileText size={24}/><p>{text}</p><button className="text-button" onClick={onAction}>Add signals <ArrowRight size={14}/></button></div>; }
function IssueRow({ theme, onClick }: { theme: Theme; onClick: () => void }) { return <button className="issue-row" onClick={onClick}><span className="issue-row-icon"><Tag size={17}/></span><span><strong>{theme.name}</strong><small>{theme.sources.map(sourceLabel).join(' · ')}</small></span><b>{theme.signalIds.length} mentions</b><ArrowRight size={16}/></button>; }
function SourceMix({ signals }: { signals: Signal[] }) { const items: { source: Source; label: string }[] = [{ source: 'support', label: 'Support tickets' }, { source: 'note', label: 'Sales & team notes' }, { source: 'review', label: 'Product reviews' }]; return <div className="source-mix">{items.map(({ source, label }) => { const count = signals.filter((signal) => signal.source === source).length; return <div className="source-mix-row" key={source}><div><span><i className={`source-dot ${source}`}/>{label}</span><b>{count}</b></div><div className="mix-track"><i className={source} style={{ width: `${signals.length ? count / signals.length * 100 : 0}%` }}/></div></div>; })}</div>; }
function ThemeDetail({ theme, signals, onRename, onLane, onHide }: { theme: Theme | null; signals: Signal[]; onRename: (theme: Theme) => void; onLane: (theme: Theme, lane: Lane) => void; onHide: (theme: Theme) => void }) { if (!theme) return <Empty text="Select an issue to see its evidence." onAction={() => {}}/>; const evidence = signals.filter((signal) => theme.signalIds.includes(signal.id)); return <><div className="detail-top"><span className="eyebrow">ISSUE DETAIL</span><button className="icon-button" aria-label="More options" title="Hide this theme" onClick={() => onHide(theme)}><MoreHorizontal size={17}/></button></div><h3>{theme.name}</h3><button className="rename-link" onClick={() => onRename(theme)}>Rename issue <ArrowRight size={13}/></button><div className="detail-metrics"><div><strong>{theme.signalIds.length}</strong><small>repeat signals</small></div><div><strong>{theme.sources.length}</strong><small>source types</small></div><div><strong>{theme.score}</strong><small>priority score</small></div></div><div className="detail-section"><span className="eyebrow">WHY THIS WAS GROUPED</span><p>{theme.rationale}</p><span className="confidence"><Check size={13}/>{theme.confidence} evidence confidence</span></div><div className="detail-section"><span className="eyebrow">CUSTOMER EVIDENCE</span><div className="quotes">{evidence.map((signal) => <blockquote key={signal.id}><span className={`source-chip ${signal.source}`}>{sourceLabel(signal.source)}</span><p>“{signal.text}”</p></blockquote>)}</div></div><div className="detail-section"><span className="eyebrow">ROADMAP LANE</span><div className="lane-buttons">{(['Now', 'Next', 'Later'] as Lane[]).map((lane) => <button key={lane} className={theme.lane === lane ? 'chosen' : ''} onClick={() => onLane(theme, lane)}>{lane}</button>)}</div></div><button className="hide-link" onClick={() => onHide(theme)}>Hide theme from analysis</button></>; }
