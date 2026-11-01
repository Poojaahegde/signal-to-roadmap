import type { Workspace } from './analysis';
export type Product = { id: string; name: string; description: string; audience: string; problem: string; goals: string; features: string; competitors: string; stage: string; website: string; workspace: Workspace };
export type Company = { name: string; industry: string; website: string; description: string; products: Product[] };
type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } };
const env = (import.meta as unknown as {env: Record<string,string>}).env;
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.VITE_SUPABASE_ANON_KEY || '';
export const configured = Boolean(url && key);
export const emailReady = env.VITE_AUTH_EMAIL_READY === 'true';
const SESSION = 'str-cloud-session-v1';
export function session(): Session | null { try { return JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { return null; } }
function remember(s: Session) { const next = {...s, expires_at: s.expires_at || Math.floor(Date.now()/1000)+3600}; sessionStorage.setItem(SESSION, JSON.stringify(next)); return next; }
async function request(path: string, body?: unknown, token?: string, method = 'POST', extra: Record<string,string> = {}) {
  if (!configured) throw new Error('Company sign-in is not connected yet. You can explore the sample workspace.');
  const r = await fetch(`${url}${path}`, {method, headers: {apikey:key, 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...extra}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.msg || data?.error_description || data?.message || 'The request failed. Please try again.');
  return data;
}
export async function sendCode(email: string) { const redirect = window.location.origin + window.location.pathname; await request('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), {email, create_user:true}); }
export async function verifyCode(email: string, token: string) { return remember(await request('/auth/v1/verify', {email,token,type:'email'})); }
async function authorized() {
  let s = session(); if (!s) throw new Error('Please sign in again.');
  if (s.expires_at < Date.now()/1000+60) s = remember(await request('/auth/v1/token?grant_type=refresh_token', {refresh_token:s.refresh_token}));
  return s;
}
export async function signOut() { try { const s=session(); if(s) await request('/auth/v1/logout', {}, s.access_token); } finally { sessionStorage.removeItem(SESSION); } }
export async function loadCompany(): Promise<{data:Company; version:number} | null> {
  const s=await authorized();
  const rows=await request(`/rest/v1/company_workspaces?owner_id=eq.${encodeURIComponent(s.user.id)}&select=data,version`, undefined,s.access_token,'GET');
  return rows[0] || null;
}
export async function saveCompany(data: Company, version: number | null): Promise<number> {
  const s=await authorized();
  const path=version === null ? '/rest/v1/company_workspaces' : `/rest/v1/company_workspaces?owner_id=eq.${encodeURIComponent(s.user.id)}&version=eq.${version}`;
  const rows = await request(path, {owner_id:s.user.id, data, version:version === null ? 1 : version+1}, s.access_token, version === null ? 'POST' : 'PATCH', {Prefer:'return=representation'});
  if (!rows?.length) throw new Error('Another session saved newer changes. Export your changes, then reload before saving again.');
  return rows[0].version;
}
export function emptyProduct(): Product { return {id:crypto.randomUUID(), name:'',description:'',audience:'',problem:'',goals:'',features:'',competitors:'',stage:'Discovery',website:'',workspace:{signals:[],names:{},lanes:{},hidden:[]}}; }

let callback: Promise<Session | null> | undefined;
export function finishEmailSignIn(): Promise<Session | null> {
  if (callback) return callback;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const access = params.get('access_token'), refresh = params.get('refresh_token');
  if (!access || !refresh) {
    const error = params.get('error_description');
    if (error) { window.history.replaceState(null, '', window.location.pathname + window.location.search); return Promise.reject(new Error(error)); }
    return Promise.resolve(null);
  }
  // Remove credentials from the address bar immediately; verify with Auth before storing.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  callback = (async () => {
    if (!['magiclink', 'signup'].includes(params.get('type') || 'magiclink')) throw new Error('This link is not a sign-in link. Request a new sign-in email.');
    const user = await request('/auth/v1/user', undefined, access, 'GET');
    const duration = Number(params.get('expires_in') || 3600);
    return remember({access_token:access, refresh_token:refresh, user, expires_at:Math.floor(Date.now()/1000) + (Number.isFinite(duration) ? Math.min(duration,3600) : 3600)});
  })();
  return callback;
}
