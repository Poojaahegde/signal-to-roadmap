export type Source = 'support' | 'note' | 'review';
export type Lane = 'Now' | 'Next' | 'Later';
export type Signal = {
  id: string;
  source: Source;
  text: string;
  createdAt: string;
  account?: string;
};
export type Theme = {
  id: string;
  name: string;
  initiative: string;
  signalIds: string[];
  sources: Source[];
  score: number;
  urgency: number;
  confidence: 'High' | 'Medium' | 'Low';
  lane: Lane;
  rationale: string;
};
export type Workspace = {
  signals: Signal[];
  names: Record<string, string>;
  lanes: Record<string, Lane>;
  hidden: string[];
};

const RULES: { id: string; name: string; terms: string[] }[] = [
  { id: 'sync', name: 'Integration sync failures', terms: ['sync', 'synchroniz', 'integration', 'quickbooks', 'salesforce', 'webhook', 'connected app', 'disconnect', 'duplicate record'] },
  { id: 'onboarding', name: 'Onboarding setup friction', terms: ['onboard', 'setup', 'set up', 'getting started', 'first run', 'invite', 'activation', 'tutorial', 'walkthrough'] },
  { id: 'performance', name: 'Slow pages and timeouts', terms: ['slow', 'latency', 'timeout', 'takes forever', 'loading', 'lag', 'freeze', 'crash', 'performance'] },
  { id: 'reporting', name: 'Reporting and export gaps', terms: ['report', 'dashboard', 'analytics', 'export', 'csv', 'pdf', 'metric', 'chart', 'download'] },
  { id: 'permissions', name: 'Permissions and access control', terms: ['permission', 'role', 'access', 'admin', 'security', 'privacy', 'login', 'sign in', 'sso', 'two-factor'] },
  { id: 'search', name: 'Search and filtering limits', terms: ['search', 'filter', 'find', 'sort', 'query', 'lookup', 'result'] },
  { id: 'notification', name: 'Missing or noisy notifications', terms: ['notification', 'alert', 'email', 'reminder', 'digest', 'inbox', 'notify'] },
  { id: 'billing', name: 'Billing and payment confusion', terms: ['billing', 'payment', 'invoice', 'pricing', 'charge', 'refund', 'subscription', 'receipt'] },
  { id: 'mobile', name: 'Mobile workflow friction', terms: ['mobile', 'phone', 'tablet', 'ios', 'android', 'small screen', 'responsive'] },
  { id: 'collaboration', name: 'Team handoff and collaboration', terms: ['collaborat', 'handoff', 'comment', 'share', 'teammate', 'approval', 'assign', 'team'] },
];
const INITIATIVES: Record<string, string> = {
  sync: 'Make sync failures visible and recoverable',
  onboarding: 'Shorten the first-run setup path',
  performance: 'Reduce load time and timeout failures',
  reporting: 'Make reports and exports more dependable',
  permissions: 'Clarify roles and enforce access rules',
  search: 'Help people find records faster',
  notification: 'Give teams control over notifications',
  billing: 'Make charges and receipts easy to understand',
  mobile: 'Stabilize core mobile workflows',
  collaboration: 'Improve team handoffs and ownership',
};

const URGENT = ['blocked', 'cannot', "can't", 'failed', 'broken', 'outage', 'lost', 'error', 'urgent', 'critical'];
const STOPWORDS = new Set(['about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'but', 'can', 'cannot', 'could', 'customer', 'does', 'every', 'for', 'from', 'have', 'into', 'just', 'more', 'need', 'never', 'not', 'only', 'our', 'please', 'really', 'same', 'some', 'that', 'the', 'their', 'there', 'these', 'this', 'through', 'when', 'where', 'which', 'while', 'with', 'would', 'your']);
function keywords(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z]{4,}/g) || [])
    .filter((word) => !STOPWORDS.has(word))
    .map((word) => word.replace(/(ing|ed|es|s)$/, ''))
    .filter((word) => word.length >= 4))];
}
function nameFromText(text: string): string {
  const words = (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).filter((word) => !STOPWORDS.has(word.toLowerCase()));
  const name = words.slice(0, 4).join(' ');
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : 'New issue to review';
}

export function parseInput(raw: string, defaultSource: Source): Omit<Signal, 'id' | 'createdAt'>[] {
  return raw.split(/\n\s*\n|\n(?=(?:support|ticket|note|sales|review)\s*[:|\-])/i)
    .flatMap((block) => block.split('\n').filter(Boolean).length > 1 && block.length < 700
      ? block.split('\n') : [block])
    .map((line) => line.trim()).filter(Boolean)
    .map((line) => {
      const prefix = line.match(/^(support|ticket|note|sales|review)\s*[:|\-]\s*/i);
      const source: Source = prefix ? /support|ticket/i.test(prefix[1]) ? 'support' : /review/i.test(prefix[1]) ? 'review' : 'note' : defaultSource;
      return { source, text: prefix ? line.slice(prefix[0].length).trim() : line };
    }).filter((item) => item.text.length >= 8);
}

export function analyze(workspace: Workspace): Theme[] {
  const groups = new Map<string, Set<string>>();
  const dynamicNames = new Map<string, string>();
  const unmatched: Signal[] = [];
  for (const signal of workspace.signals) {
    const text = signal.text.toLowerCase();
    const scores = RULES.map((rule) => ({ rule, score: rule.terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0) }));
    const strongest = Math.max(...scores.map((item) => item.score));
    const matches = scores.filter((item) => item.score > 0 && item.score >= strongest - 1).slice(0, 2);
    if (!matches.length) { unmatched.push(signal); continue; }
    const ids = matches.map(({ rule }) => rule.id);
    for (const id of ids) {
      if (!groups.has(id)) groups.set(id, new Set());
      groups.get(id)!.add(signal.id);
    }
  }
  const dynamicGroups: { id: string; terms: string[] }[] = [];
  for (const signal of unmatched) {
    const terms = keywords(signal.text);
    const match = dynamicGroups.find((group) => {
      const common = terms.filter((term) => group.terms.includes(term)).length;
      return common >= 2 && common / Math.max(terms.length, group.terms.length) >= .22;
    });
    const id = match?.id || `new-${signal.id}`;
    if (!match) { dynamicGroups.push({ id, terms }); dynamicNames.set(id, nameFromText(signal.text)); }
    if (!groups.has(id)) groups.set(id, new Set());
    groups.get(id)!.add(signal.id);
  }
  const maxGroupSize = Math.max(1, ...Array.from(groups.values(), (ids) => ids.size));
  return Array.from(groups.entries()).map(([id, ids]) => {
    const selected = workspace.signals.filter((signal) => ids.has(signal.id));
    const sources = Array.from(new Set(selected.map((signal) => signal.source)));
    const urgency = selected.filter((signal) => URGENT.some((word) => signal.text.toLowerCase().includes(word))).length;
    const frequency = selected.length / maxGroupSize;
    const score = Math.min(100, Math.round(frequency * 65 + (sources.length / 3) * 25 + (urgency / selected.length) * 10));
    const lane: Lane = workspace.lanes[id] || (score >= 75 && selected.length >= 3 ? 'Now' : score >= 45 ? 'Next' : 'Later');
    const confidence: Theme['confidence'] = selected.length >= 4 && sources.length >= 2 ? 'High' : selected.length >= 2 ? 'Medium' : 'Low';
    const name = workspace.names[id] || RULES.find((rule) => rule.id === id)?.name || dynamicNames.get(id) || 'New issue to review';
    return {
      id,
      name,
      initiative: INITIATIVES[id] || `Investigate: ${name}`,
      signalIds: [...ids], sources, score, urgency, confidence, lane,
      rationale: `${selected.length} ${selected.length === 1 ? 'signal' : 'signals'} across ${sources.length} ${sources.length === 1 ? 'source' : 'sources'}${urgency ? `; ${urgency} mention a blocking or failed experience` : ''}. Review the linked evidence before committing to a solution.`,
    };
  }).filter((theme) => !workspace.hidden.includes(theme.id)).sort((a, b) => b.score - a.score || b.signalIds.length - a.signalIds.length);
}

export const SAMPLE_SIGNALS: Signal[] = [
  ['support', 'The QuickBooks sync failed again and invoices are now out of date.'],
  ['support', 'Our integration disconnects every morning and we cannot trust the synced records.'],
  ['note', 'Buyer asked whether the Salesforce integration can recover automatically after an error.'],
  ['review', 'Useful app, but duplicate records appear after every sync.'],
  ['support', 'The onboarding setup takes too long; our new team could not invite coworkers.'],
  ['note', 'Prospect loved the demo but said first-run setup would need an admin walkthrough.'],
  ['review', 'Getting started is confusing. A short tutorial would help.'],
  ['support', 'The report export times out when I download a CSV.'],
  ['review', 'Analytics are helpful but I cannot build the report our leadership needs.'],
  ['note', 'Enterprise buyer needs a weekly PDF report for operations reviews.'],
  ['support', 'Search filters reset every time I return to the results page.'],
  ['review', 'It takes too long to find a record because search results are not sortable.'],
  ['support', 'My team receives too many email notifications for routine comments.'],
  ['note', 'Account team asked for a daily digest instead of one alert per update.'],
  ['support', 'The dashboard is slow to load for our largest account.'],
  ['review', 'Mobile pages freeze when I open a large customer record.'],
  ['support', 'A viewer can edit records even though their permission should be read only.'],
  ['note', 'Security review found role access difficult to explain to new administrators.'],
  ['review', 'Billing is confusing; I cannot see which subscription produced a charge.'],
  ['support', 'Please make it easier to find the receipt for last month’s payment.'],
].map(([source, text], index) => ({ id: `sample-${index}`, source: source as Source, text, createdAt: new Date(Date.now() - (index % 10) * 86400000).toISOString() }));

export function exportRoadmap(themes: Theme[], signals: Signal[]): string {
  return ['# Signal to Roadmap — draft for review', '', `Generated ${new Date().toLocaleDateString()}. Counts represent distinct input records, not customers.`, '',
    ...themes.flatMap((theme) => [
      `## ${theme.lane}: ${theme.initiative}`, `Customer issue: ${theme.name}`, `Priority score: ${theme.score}/100 · ${theme.signalIds.length} signals · ${theme.confidence} evidence confidence`,
      theme.rationale, '', 'Evidence:',
      ...signals.filter((signal) => theme.signalIds.includes(signal.id)).slice(0, 3).map((signal) => `- [${signal.source}] ${signal.text}`), '',
    ]), 'Review themes, duplicate customer accounts, effort, and strategy before committing dates.'].join('\n');
}
