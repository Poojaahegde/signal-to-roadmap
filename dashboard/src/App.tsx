import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine, ArrowRight, Bell, Check, ChevronDown, CircleHelp, FileText,
  Filter, GitBranch, Inbox, Layers3, LayoutDashboard, Menu, MessageSquareText,
  MoreHorizontal, Plus, Search, Settings2, Sparkles, Tag, Trash2, Upload, X,
} from 'lucide-react';
import { analyze, exportRoadmap, parseInput, SAMPLE_SIGNALS, type Lane, type Signal, type Source, type Theme, type Workspace } from './analysis';

import { parseTable, tableSignals, partitionSignals, decodeFeedback, MAX_FILE_BYTES, MAX_IMPORT_ROWS, type ImportTable, type IncomingSignal } from './importFeedback';

type FilePreview = { name: string; raw: string; table?: ImportTable; signals?: IncomingSignal[] };
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
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function sourceLabel(source: Source) { return source === 'support' ? 'Support' : source === 'note' ? 'Notes' : 'Reviews'; }
function initials(text: string) { return text.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }

export default function App({ initial, onChange, companyName, productName, cloud = false }: { initial?: Workspace; onChange?: (next: Workspace) => void; companyName?: string; productName?: string; cloud?: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => initial || initialWorkspace());
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roadmapDraft, setRoadmapDraft] = useState<{id:string;title:string;description:string;lane:Lane}|null>(null);
  const [composer, setComposer] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'blank'|'sample'|null>(null);
  const [renaming, setRenaming] = useState<Theme|null>(null);
  const [newName, setNewName] = useState('');
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [importError, setImportError] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const readRequest = useRef(0);
  const [rawInput, setRawInput] = useState('');
  const [inputSource, setInputSource] = useState<Source>('support');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!composer) { readRequest.current++; setFilePreview(null); setImportError(''); setReadingFile(false); } }, [composer]);
  const imported = filePreview?.table ? tableSignals(filePreview.table, inputSource) : { signals: filePreview?.signals ? parseInput(filePreview.raw, inputSource) : [], blank: 0 };
  const pendingImport = partitionSignals(imported.signals, workspace.signals);

  useEffect(() => {
    if (!composer && !confirmAction && !renaming && !roadmapDraft) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>(selector) || []);
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { setComposer(false); setConfirmAction(null); setRenaming(null); setRoadmapDraft(null); }
      if (event.key === 'Tab') {
        const items = controls(); const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [composer, confirmAction, renaming, Boolean(roadmapDraft)]);


  const roadmapThemes = useMemo(() => analyze(workspace), [workspace]);
  const themes = roadmapThemes.filter(theme=>!theme.manual);
  const selected = themes.find((theme) => theme.id === selectedId) || null;
  const filteredSignals = workspace.signals.filter((signal) =>
    (sourceFilter === 'all' || signal.source === sourceFilter) &&
    (!query || `${signal.text} ${signal.account || ''}`.toLowerCase().includes(query.toLowerCase())));
  const totalSources = new Set(workspace.signals.map((signal) => signal.source)).size;
  const urgentIssues = themes.filter((theme) => theme.lane === 'Now').length;
  const isSample = workspace.signals.some((signal) => signal.id.startsWith('sample-'));

  function update(next: Workspace) {
    setWorkspace(next);
    onChange?.(next);
    if (initial) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setNotice('Browser storage is full; this session will not persist.'); }
  }
  function addSignals(items: IncomingSignal[], blankRows = 0) {
    const { unique, duplicates } = partitionSignals(items, workspace.signals);
    if (!unique.length) {
      setImportError(items.length ? 'All of these records are already in this product workspace. No feedback was added.' : 'No feedback text was found. Choose the column containing the customer feedback, or paste some text.');
      return;
    }
    update({ ...workspace, signals: [...workspace.signals, ...unique.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }))] });
    setRawInput(''); setComposer(false); setView('signals'); setQuery(''); setSourceFilter('all');
    setNotice(`${unique.length} feedback ${unique.length === 1 ? 'record' : 'records'} added.${duplicates ? ` ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped.` : ''}${blankRows ? ` ${blankRows} empty row${blankRows === 1 ? '' : 's'} skipped.` : ''} View your roadmap to organize the suggested initiatives.`);
  }
  async function onFile(file?: File) {
    if (!file) return;
    const request = ++readRequest.current;
    setImportError(''); setFilePreview(null);
    try {
      if (!/\.(csv|txt)$/i.test(file.name)) throw new Error('This upload supports CSV and TXT files. For Excel, use Save As → CSV UTF-8 first.');
      if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 2 MB. Split it into smaller CSV or TXT files.');
      setReadingFile(true);
      const raw = decodeFeedback(await file.arrayBuffer());
      if (request !== readRequest.current) return;
      if (!raw.trim()) throw new Error('This file is empty. Add feedback text and upload it again.');
      if (/\.csv$/i.test(file.name)) setFilePreview({name:file.name,raw,table:parseTable(raw)});
      else {
        const signals = parseInput(raw, inputSource);
        if (!signals.length) throw new Error('No feedback text was found. Add one feedback record per line.');
        if (signals.length > MAX_IMPORT_ROWS) throw new Error(`Import up to ${MAX_IMPORT_ROWS.toLocaleString()} records at a time. Split this TXT file into smaller files.`);
        setFilePreview({name:file.name,raw,signals});
      }
    } catch (error) {
      if (request === readRequest.current) setImportError(error instanceof Error ? error.message : 'The file could not be read. Try exporting it as CSV UTF-8.');
    } finally {
      if (request === readRequest.current) { setReadingFile(false); if (fileInput.current) fileInput.current.value = ''; }
    }
  }
  function setImportColumn(field: 'textColumn' | 'sourceColumn' | 'accountColumn', value: number) {
    setImportError(''); setFilePreview(current => current?.table ? {...current,table:{...current.table,[field]:value}} : current);
  }
  function renameTheme(theme: Theme) { setRenaming(theme); setNewName(theme.name); }
  function setLane(theme: Theme, lane: Lane) { if(theme.manual){update({...workspace,roadmapItems:(workspace.roadmapItems||[]).map(item=>item.id===theme.id?{...item,lane}:item)});return;} update({ ...workspace, lanes: { ...workspace.lanes, [theme.id]: lane } }); }
  function hideTheme(theme: Theme) { update({ ...workspace, hidden: [...workspace.hidden, theme.id] }); setSelectedId(null); }
  function resetWorkspace() { setConfirmAction('sample'); }
  function newWorkspace() { setConfirmAction('blank'); }

  const nav: { id: View; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'signals', label: 'Feedback inbox', icon: Inbox, count: workspace.signals.length },
    { id: 'issues', label: 'Feedback themes', icon: Layers3, count: themes.length },
    { id: 'roadmap', label: 'Roadmap', icon: GitBranch },
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✦</span><span>Signal<span className="brand-light"> to Roadmap</span></span></div>
      <nav className="top-links" aria-label="Primary"><button onClick={() => setView('overview')}>Home</button><button onClick={() => setView('issues')}>Issues</button><button onClick={() => setView('roadmap')}>Roadmap</button></nav>
      <div className="top-actions"><span className="local-pill"><span className="live-dot" /> {cloud ? 'Company workspace' : 'Local workspace'}</span><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={19}/></button><button className="top-cta" onClick={() => setComposer(true)}><Plus size={15}/> Add feedback</button></div>
    </header>

    <details className="how-guide"><summary>How it works · Start here</summary><div className="how-steps"><article><b>1. Add customer feedback</b><p>Click Add feedback. Paste one comment per line, or upload CSV/TXT. Check the count, then click Add or Import. Selecting a file alone does not import it.</p><button className="outline-button" onClick={()=>setComposer(true)}>Add feedback</button></article><article><b>2. Review the suggestions</b><p>The app groups similar wording into themes and suggests an initiative for each theme. Two comments about the same problem can become one roadmap card. This uses keyword rules, not AI.</p><button className="outline-button" onClick={()=>setView('issues')}>Review feedback themes</button></article><article><b>3. Make the roadmap yours</b><p>Open Roadmap. Use the lane menu to move a card to Now, Next or Later. Use Add roadmap item for your own initiative. “See original feedback” shows where a suggestion came from.</p><button className="outline-button" onClick={()=>setView('roadmap')}>Open roadmap</button></article></div><p className="how-save">{cloud?'Click Save changes in the top bar to save to your account.':'Guest work is saved in this browser only. Export a backup to keep a separate copy.'} Product details provide context; they do not automatically create roadmap items.</p></details>
    <section className="hero" aria-label="Product introduction">
      <video aria-hidden="true" className="hero-video" src={VIDEO_URL} autoPlay muted loop playsInline preload="none" />
      <div className="hero-wash" />
      <motion.div className="hero-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <span className="hero-badge"><Sparkles size={13}/> The customer voice, made actionable</span>
        <h1>Find the <em>pattern.</em> Build the right thing.</h1>
        <p>Bring customer conversations, interviews, surveys, and reviews into one place. See recurring issues, inspect the evidence, and shape a roadmap your team can challenge.</p>
      </motion.div>
    </section>

    <motion.div className="dashboard-frame" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6 }}>
      <div className="dashboard">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="sidebar-top"><span className="workspace-icon">S</span><span><strong>{productName || 'Product workspace'}</strong><small>{companyName || (isSample ? 'Sample data' : 'Your local data')}</small></span><ChevronDown size={14}/></div>
          <div className="sidebar-label">WORKSPACE</div>
          <nav aria-label="Workspace views">{nav.map((item) => <button key={item.id} className={`side-link ${view === item.id ? 'active' : ''}`} onClick={() => { setView(item.id); setMobileNav(false); }}><item.icon size={16}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}</button>)}</nav>
          <div className="sidebar-label sidebar-label-later">SOURCES</div>
          <div className="source-list"><span><i className="source-dot support"/>Customer conversations</span><span><i className="source-dot note"/>Interviews & notes</span><span><i className="source-dot review"/>Reviews & surveys</span></div>
          <div className="sidebar-bottom"><button onClick={newWorkspace}><Plus size={15}/> Clear feedback</button><button onClick={resetWorkspace}><Settings2 size={15}/> Load example feedback</button><div className="privacy-note"><CircleHelp size={15}/> {cloud ? 'Changes stay private. Save to sync them.' : 'Saved on this device. No cloud sync.'}</div></div>
        </aside>

        <main className="workspace-main">
          <div className="workspace-toolbar"><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{nav.find((item) => item.id === view)?.label}</strong></div><div className="toolbar-actions"><span className="draft-tag">DRAFT ANALYSIS</span><button className="icon-button" title="Add feedback" onClick={() => setComposer(true)}><Plus size={17}/></button><button className="icon-button" title="Export roadmap" onClick={() => download('signal-to-roadmap.md', exportRoadmap(roadmapThemes, workspace.signals), 'text/markdown')}><ArrowDownToLine size={16}/></button><span className="avatar">You</span></div></div>
          <div className="workspace-scroll">
            {notice && <div className="notice" role="status">{notice}{view==='signals' && workspace.signals.length>0 && <button className="outline-button" onClick={()=>setView('roadmap')}>View roadmap →</button>}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14}/></button></div>}
            {view === 'overview' && <>
              <div className="section-heading"><div><span className="eyebrow">GOOD MORNING, PRODUCT TEAM</span><h2>What customers are telling you.</h2><p>Recurring patterns are grouped below. Open any issue to trace it back to the original words.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add customer feedback</button></div>
              <div className="stat-grid"><Stat label="Feedback collected" value={workspace.signals.length} icon={<MessageSquareText size={17}/>} sub="Saved feedback records"/><Stat label="Issue themes" value={themes.length} icon={<Layers3 size={17}/>} sub="Grouped by shared language"/><Stat label="Sources represented" value={totalSources} icon={<Inbox size={17}/>} sub="Support, notes, reviews"/><Stat label="Now candidates" value={urgentIssues} icon={<GitBranch size={17}/>} sub="Review before commitment"/></div>
              <div className="content-grid"><div className="panel"><div className="panel-heading"><div><span className="eyebrow">ISSUE RADAR</span><h3>Most repeated issues</h3></div><button className="text-button" onClick={() => setView('issues')}>All issues <ArrowRight size={14}/></button></div>{themes.length ? themes.slice(0, 5).map((theme) => <IssueRow key={theme.id} theme={theme} onClick={() => { setSelectedId(theme.id); setView('issues'); }}/>) : <Empty text="Add a few customer signals to see patterns emerge." onAction={() => setComposer(true)}/>}</div><div className="panel source-panel"><div className="panel-heading"><div><span className="eyebrow">SOURCE MIX</span><h3>Where the evidence comes from</h3></div><MoreHorizontal size={17}/></div><SourceMix signals={workspace.signals}/><div className="insight-box"><Sparkles size={17}/><div><strong>Count signals, then inspect context.</strong><p>One loud customer can submit many tickets. These are input counts, not unique customers.</p></div></div><button className="outline-button wide" onClick={() => setView('roadmap')}>Review draft roadmap <ArrowRight size={15}/></button></div></div>
            </>}
            {view === 'signals' && <><div className="section-heading"><div><span className="eyebrow">UNSTRUCTURED INPUT, ORGANIZED</span><h2>Feedback inbox</h2><p>Every source stays visible so a theme can always be traced back to evidence.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add feedback</button></div><div className="panel"><div className="filterbar"><label className="searchbox"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search feedback" aria-label="Search feedback"/></label><label className="select-wrap"><Filter size={15}/><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as Source | 'all')} aria-label="Filter source"><option value="all">All sources</option><option value="support">Support</option><option value="note">Notes</option><option value="review">Reviews</option></select></label><span className="result-count">{filteredSignals.length} shown</span></div><div className="signal-list">{filteredSignals.length ? filteredSignals.map((signal) => <div className="signal-row" key={signal.id}><span className={`source-chip ${signal.source}`}>{sourceLabel(signal.source)}</span><div><p>{signal.text}</p><small>{signal.account ? `${signal.account} · ` : ''}{new Date(signal.createdAt).toLocaleDateString()}</small></div><button title="Remove signal" aria-label={`Remove signal: ${signal.text}`} onClick={() => update({ ...workspace, signals: workspace.signals.filter((item) => item.id !== signal.id) })}><Trash2 size={15}/></button></div>) : <Empty text="No signals match your filter." onAction={() => setComposer(true)}/>}</div></div></>}
            {view === 'issues' && <><div className="section-heading"><div><span className="eyebrow">PATTERNS, NOT ANECDOTES</span><h2>Feedback themes</h2><p>Each theme has a repeat count, source mix, and inspectable evidence. Rename or set its roadmap lane.</p></div><button className="solid-button" onClick={() => setComposer(true)}><Plus size={15}/> Add feedback</button></div><div className="issue-layout"><div className="panel issue-table"><div className="table-head"><span>ISSUE THEME</span><span>REPEATS</span><span>PRIORITY</span><span>LANE</span></div>{themes.length ? themes.map((theme) => <button key={theme.id} className={`theme-row ${selected?.id === theme.id ? 'selected' : ''}`} onClick={() => setSelectedId(theme.id)}><span className="theme-name"><span className="theme-avatar">{initials(theme.name)}</span><span><strong>{theme.name}</strong><small>{theme.sources.map(sourceLabel).join(' · ')}</small></span></span><span className="repeat-count">{theme.signalIds.length}<small>signals</small></span><span className="priority"><b>{theme.score}</b><span className="score-track"><i style={{ width: `${theme.score}%` }}/></span></span><span className={`lane-pill lane-${theme.lane.toLowerCase()}`}>{theme.lane}</span></button>) : <Empty text="No issue themes yet. Add customer signals to get started." onAction={() => setComposer(true)}/>}</div><div className="panel detail-panel"><ThemeDetail theme={selected || themes[0] || null} signals={workspace.signals} onRename={renameTheme} onLane={setLane} onHide={hideTheme}/></div></div>{workspace.hidden.length > 0 && <button className="restore-button" onClick={() => update({ ...workspace, hidden: [] })}>Restore {workspace.hidden.length} hidden {workspace.hidden.length === 1 ? 'theme' : 'themes'}</button>}</>}
            {view === 'roadmap' && <><div className="section-heading"><div><span className="eyebrow">A DECISION AID, NOT AN AUTO-PUBLISHED PLAN</span><h2>Your roadmap</h2><p>{workspace.signals.length} feedback records → {roadmapThemes.filter(t=>!t.manual).length} suggested initiatives · {roadmapThemes.filter(t=>t.manual).length} {roadmapThemes.filter(t=>t.manual).length===1?'item':'items'} added by you. Related feedback may share one initiative. Move any item between Now, Next and Later.</p></div><button className="solid-button" onClick={()=>setRoadmapDraft({id:crypto.randomUUID(),title:'',description:'',lane:'Next'})}><Plus size={15}/> Add roadmap item</button><button className="outline-button" onClick={() => download('signal-to-roadmap.md', exportRoadmap(roadmapThemes, workspace.signals), 'text/markdown')}><ArrowDownToLine size={15}/> Export draft</button></div><div className="roadmap-grid">{(['Now', 'Next', 'Later'] as Lane[]).map((lane) => <div className="roadmap-column" key={lane}><div className="lane-header"><span className={`lane-dot lane-${lane.toLowerCase()}`}/><h3>{lane}</h3><span>{roadmapThemes.filter((theme) => theme.lane === lane).length}</span></div>{roadmapThemes.filter((theme) => theme.lane === lane).map((theme) => <div className="roadmap-card" key={theme.id}><div className="roadmap-card-top"><span className="mini-tag">{theme.manual?'Added by you':`${theme.confidence} evidence confidence`}</span>{!theme.manual&&<b>{theme.score}/100</b>}</div><h4>{theme.initiative}</h4><div className="addresses">Addresses: {theme.name}</div><p>{theme.rationale}</p><div className="roadmap-card-bottom"><span><MessageSquareText size={13}/>{theme.manual?'Manual initiative':`${theme.signalIds.length} feedback ${theme.signalIds.length===1?'record':'records'}`}</span><select aria-label={`Move ${theme.name} to lane`} value={theme.lane} onChange={(event) => setLane(theme, event.target.value as Lane)}><option>Now</option><option>Next</option><option>Later</option></select></div>{theme.manual?<button className="evidence-link" onClick={()=>setRoadmapDraft({id:theme.id,title:theme.initiative,description:theme.rationale,lane:theme.lane})}>Edit item <ArrowRight size={13}/></button>:<button className="evidence-link" onClick={() => { setSelectedId(theme.id); setView('issues'); }}>See original feedback <ArrowRight size={13}/></button>}</div>)}{roadmapThemes.every((theme) => theme.lane !== lane) && <div className="empty-lane">No items in {lane}. Use “Add roadmap item” or add customer feedback.</div>}</div>)}</div><p className="roadmap-footnote">Initiative titles are hypotheses. Scores combine repeat frequency, source diversity, and language suggesting blocking or failed workflows. They do not account for unique customers, revenue, effort, or strategic fit.</p></>}
          </div>
        </main>
      </div>
    </motion.div>

    {roadmapDraft && <div className="modal-backdrop"><form className="composer" role="dialog" aria-modal="true" aria-labelledby="roadmap-item-title" onSubmit={event=>{event.preventDefault();const title=roadmapDraft.title.trim();if(!title)return;const item={...roadmapDraft,title,description:roadmapDraft.description.trim()};update({...workspace,roadmapItems:[...(workspace.roadmapItems||[]).filter(existing=>existing.id!==item.id),item]});setRoadmapDraft(null);setView('roadmap');setNotice(`“${title}” saved to ${item.lane}.${cloud?' Click Save changes to sync to your account.':' Saved on this device.'}`);}}><h2 id="roadmap-item-title">Add or edit a roadmap item</h2><p>Create your own initiative without uploading feedback. You choose the title, context and lane.</p><label className="field-label">Item title<input className="source-select" required maxLength={120} value={roadmapDraft.title} onChange={e=>setRoadmapDraft({...roadmapDraft,title:e.target.value})}/></label><label className="field-label">Description or intended outcome<textarea className="roadmap-description" maxLength={5000} value={roadmapDraft.description} onChange={e=>setRoadmapDraft({...roadmapDraft,description:e.target.value})}/></label><label className="field-label">Roadmap lane<select className="source-select" value={roadmapDraft.lane} onChange={e=>setRoadmapDraft({...roadmapDraft,lane:e.target.value as Lane})}><option>Now</option><option>Next</option><option>Later</option></select></label><div className="composer-bottom"><button type="button" className="outline-button" onClick={()=>setRoadmapDraft(null)}>Cancel</button><button className="solid-button" type="submit">Save roadmap item</button></div></form></div>}
    {(confirmAction || renaming) && <div className="modal-backdrop"><form className="composer" role="dialog" aria-modal="true" aria-label={renaming?'Rename issue':'Replace feedback'} onSubmit={event=>{event.preventDefault();if(renaming){if(!newName.trim())return;update({...workspace,names:{...workspace.names,[renaming.id]:newName.trim().slice(0,80)}});setRenaming(null);}else{update({...EMPTY,signals:confirmAction==='sample'?SAMPLE_SIGNALS:[]});setSelectedId(null);setView('overview');setConfirmAction(null);setNotice('Feedback workspace updated.');}}}><h2>{renaming?'Rename issue':'Replace this product’s feedback?'}</h2>{renaming?<label className="field-label">Issue name<input className="source-select" autoFocus required maxLength={80} value={newName} onChange={e=>setNewName(e.target.value)}/></label>:<p>This replaces the feedback and roadmap choices in this workspace. Export a backup first if you want to keep them. Company and product details stay unchanged.</p>}<div className="composer-bottom"><button type="button" className="outline-button" onClick={()=>{setConfirmAction(null);setRenaming(null);}}>Cancel</button><button className="solid-button" type="submit">{renaming?'Save name':'Replace feedback'}</button></div></form></div>}
    {composer && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setComposer(false); }}><div className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title"><div className="composer-header"><div><span className="eyebrow">ADD FEEDBACK</span><h2 id="composer-title">Bring the customer’s words.</h2></div><button className="icon-button" aria-label="Close" onClick={() => setComposer(false)}><X size={18}/></button></div>
      <p>Upload a CSV or TXT file, review its contents, then import. Or paste feedback below.</p>
      <label className="field-label" htmlFor="source">Default source</label><select id="source" className="source-select" value={inputSource} onChange={event => setInputSource(event.target.value as Source)}><option value="support">Customer conversation</option><option value="note">Interview or team note</option><option value="review">Review or survey</option></select>
      <div className="feedback-file-box"><label className="field-label" htmlFor="feedback-file">Choose a CSV or TXT file</label><input id="feedback-file" className="feedback-file-input" ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" disabled={readingFile} onChange={event => onFile(event.target.files?.[0])}/><small>Up to 2 MB and {MAX_IMPORT_ROWS.toLocaleString()} rows per file. CSV supports commas, semicolons and tabs.</small><button type="button" className="text-button" onClick={() => download('feedback-template.csv', 'feedback,source,company\n"Delivery tracking needs clearer updates.",support,Sample customer\n"I need to reschedule my appointment online.",interview,Sample customer\n', 'text/csv')}>Download an example CSV <ArrowDownToLine size={14}/></button></div>
      {readingFile && <p className="import-status" role="status">Reading your file…</p>}
      {importError && <div className="import-error" role="alert">{importError}</div>}
      {filePreview && <section className="import-preview" aria-label="Review file import"><div className="import-preview-heading"><strong>{filePreview.name}</strong><button className="text-button" onClick={() => {setFilePreview(null);setImportError('');}}>Remove file</button></div>
        {filePreview.table && <><label className="import-header-toggle"><input type="checkbox" checked={filePreview.table.hasHeader} onChange={event => {try{setFilePreview({...filePreview,table:parseTable(filePreview.raw,event.target.checked)});setImportError('');}catch(error){setImportError(error instanceof Error ? error.message : 'Could not read the table.');}}}/>First row contains column headings</label><div className="import-columns">{(['textColumn','sourceColumn','accountColumn'] as const).map(field => <label key={field}>{field==='textColumn'?'Feedback text (required)':field==='sourceColumn'?'Source (optional)':'Customer / account (optional)'}<select aria-label={field==='textColumn'?'Feedback text column':field==='sourceColumn'?'Source column':'Customer column'} value={filePreview.table![field]} onChange={event => setImportColumn(field,Number(event.target.value))}><option value={-1}>{field==='textColumn'?'Choose the feedback column':field==='sourceColumn'?'Use default source':'Not included'}</option>{filePreview.table!.headers.map((header,i)=><option key={i} value={i}>{header}</option>)}</select></label>)}</div></>}
        <p className="import-status" role="status">{filePreview.table?.textColumn===-1?'Choose the column that contains the feedback text.':`${imported.signals.length} readable records · ${pendingImport.unique.length} new · ${pendingImport.duplicates} duplicates · ${imported.blank} empty rows`}</p>
        {!!imported.signals.length && <><p className="helper">Preview of the first {Math.min(3,imported.signals.length)} records:</p><ul className="import-samples">{imported.signals.slice(0,3).map((item,i)=><li key={i}><span>{sourceLabel(item.source)}{item.account ? ` · ${item.account}` : ''}</span><p>{item.text}</p></li>)}</ul></>}
        {imported.signals.length>0 && pendingImport.unique.length===0 && <p className="import-error">All records are duplicates of feedback already in this workspace. Nothing new will be imported.</p>}
        <button type="button" className="solid-button wide" disabled={!pendingImport.unique.length||readingFile} onClick={() => addSignals(imported.signals, imported.blank)}>Import {pendingImport.unique.length} new feedback {pendingImport.unique.length===1?'record':'records'}</button>
      </section>}
      <div className="paste-feedback"><label className="field-label" htmlFor="signal-text">Or paste feedback, one record per line</label><textarea id="signal-text" value={rawInput} onChange={event => {setRawInput(event.target.value);setImportError('');}} placeholder={'support: Delivery tracking needs clearer updates.\nnote: Customers want easier appointment booking.\nreview: The mobile page is slow.'}/><p className="helper" role="status">{parseInput(rawInput,inputSource).length} feedback {parseInput(rawInput,inputSource).length===1?'record':'records'} ready to add. Put each separate comment on its own line.</p><button className="solid-button" onClick={() => addSignals(parseInput(rawInput, inputSource))} disabled={!rawInput.trim()||readingFile}><Plus size={15}/> Add pasted feedback</button></div><small className="helper">{cloud?'Save your workspace after import to sync it to your account.':'Guest feedback stays in this browser. No sign-in or product profile is required.'}</small>
    </div></div>}

  </div>;
}

function Stat({ label, value, icon, sub }: { label: string; value: number; icon: React.ReactNode; sub: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{sub}</small></div>; }
function Empty({ text, onAction }: { text: string; onAction: () => void }) { return <div className="empty-state"><FileText size={24}/><p>{text}</p><button className="text-button" onClick={onAction}>Add signals <ArrowRight size={14}/></button></div>; }
function IssueRow({ theme, onClick }: { theme: Theme; onClick: () => void }) { return <button className="issue-row" onClick={onClick}><span className="issue-row-icon"><Tag size={17}/></span><span><strong>{theme.name}</strong><small>{theme.sources.map(sourceLabel).join(' · ')}</small></span><b>{theme.signalIds.length} mentions</b><ArrowRight size={16}/></button>; }
function SourceMix({ signals }: { signals: Signal[] }) { const items: { source: Source; label: string }[] = [{ source: 'support', label: 'Customer conversations' }, { source: 'note', label: 'Interviews & notes' }, { source: 'review', label: 'Reviews & surveys' }]; return <div className="source-mix">{items.map(({ source, label }) => { const count = signals.filter((signal) => signal.source === source).length; return <div className="source-mix-row" key={source}><div><span><i className={`source-dot ${source}`}/>{label}</span><b>{count}</b></div><div className="mix-track"><i className={source} style={{ width: `${signals.length ? count / signals.length * 100 : 0}%` }}/></div></div>; })}</div>; }
function ThemeDetail({ theme, signals, onRename, onLane, onHide }: { theme: Theme | null; signals: Signal[]; onRename: (theme: Theme) => void; onLane: (theme: Theme, lane: Lane) => void; onHide: (theme: Theme) => void }) { if (!theme) return <Empty text="Select an issue to see its evidence." onAction={() => {}}/>; const evidence = signals.filter((signal) => theme.signalIds.includes(signal.id)); return <><div className="detail-top"><span className="eyebrow">ISSUE DETAIL</span><button className="icon-button" aria-label="More options" title="Hide this theme" onClick={() => onHide(theme)}><MoreHorizontal size={17}/></button></div><h3>{theme.name}</h3><button className="rename-link" onClick={() => onRename(theme)}>Rename issue <ArrowRight size={13}/></button><div className="detail-metrics"><div><strong>{theme.signalIds.length}</strong><small>repeat signals</small></div><div><strong>{theme.sources.length}</strong><small>source types</small></div><div><strong>{theme.score}</strong><small>priority score</small></div></div><div className="detail-section"><span className="eyebrow">WHY THIS WAS GROUPED</span><p>{theme.rationale}</p><span className="confidence"><Check size={13}/>{theme.confidence} evidence confidence</span></div><div className="detail-section"><span className="eyebrow">CUSTOMER EVIDENCE</span><div className="quotes">{evidence.map((signal) => <blockquote key={signal.id}><span className={`source-chip ${signal.source}`}>{sourceLabel(signal.source)}</span><p>“{signal.text}”</p></blockquote>)}</div></div><div className="detail-section"><span className="eyebrow">ROADMAP LANE</span><div className="lane-buttons">{(['Now', 'Next', 'Later'] as Lane[]).map((lane) => <button key={lane} className={theme.lane === lane ? 'chosen' : ''} onClick={() => onLane(theme, lane)}>{lane}</button>)}</div></div><button className="hide-link" onClick={() => onHide(theme)}>Hide theme from analysis</button></>; }
