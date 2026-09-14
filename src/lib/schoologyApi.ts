// Schoology REST API client using two-legged OAuth 1.0a with the user's own API key/secret
// (Schoology → Settings → API, https://app.schoology.com/api). Requests go through the user's CORS proxy.
import type { TaskType } from './types';
import type { ExternalAssignment } from './schoology';
import { inferType } from './schoology';

export const API_BASE = 'https://api.schoology.com/v1';

function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function nonce(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Build the OAuth 1.0a Authorization header (HMAC-SHA1, two-legged: empty token). Exported for tests. */
export async function oauthHeader(
  method: string,
  url: string,
  key: string,
  secret: string,
  opts: { timestamp?: number; nonce?: string; query?: Record<string, string> } = {},
): Promise<string> {
  const ts = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const n = opts.nonce ?? nonce();
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const params: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: n,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: '',
    oauth_version: '1.0',
  };
  const all: Record<string, string> = { ...params };
  u.searchParams.forEach((v, k) => (all[k] = v));
  for (const [k, v] of Object.entries(opts.query ?? {})) all[k] = v;
  const normalized = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join('&');
  const base = `${method.toUpperCase()}&${enc(baseUrl)}&${enc(normalized)}`;
  const signature = await hmacSha1Base64(`${enc(secret)}&`, base);
  const header = Object.entries({ ...params, oauth_signature: signature })
    .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
    .join(', ');
  return `OAuth ${header}`;
}

export interface SchoologyCreds {
  key: string;
  secret: string;
  proxy: string; // required in browsers: prefix that forwards to api.schoology.com and passes the Authorization header
}

export function proxied(proxy: string, url: string): string {
  if (!proxy) return url;
  return proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(url)) : proxy + encodeURIComponent(url);
}

export async function apiGet<T>(creds: SchoologyCreds, path: string, query: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const auth = await oauthHeader('GET', url.toString(), creds.key, creds.secret);
  const res = await fetch(proxied(creds.proxy, url.toString()), { headers: { Authorization: auth, Accept: 'application/json', 'X-Schoology-Authorization': auth } });
  if (res.status === 401) throw new Error('Schoology rejected the key/secret (401). Copy them again from app.schoology.com/api.');
  if (res.status === 403) throw new Error('Schoology refused (403). Your school may have disabled API access for students.');
  if (!res.ok) throw new Error(`Schoology API ${res.status}`);
  return (await res.json()) as T;
}

// ---------- typed slices of the API we use ----------
export interface SgyUser { uid: string; name_display: string; primary_email?: string; school_id?: string }
export interface SgySection { id: string; course_title: string; section_title: string; course_code?: string; active?: number | string; grading_periods?: number[] }
export interface SgyAssignment { id: string; title: string; description?: string; due?: string; grading_category?: string; max_points?: string; type?: string; completed?: string; web_url?: string; grading_period?: string; assignment_type?: string; dropbox_locked?: string; completion_status?: string }
export interface SgyGradeItem { assignment_id: string; grade: string | null; max_points?: string; comment?: string; exception?: number | string }
export interface SgyGradesResponse { section: { section_id: string; period: { period_id: string; period_title?: string; assignment: SgyGradeItem[] }[]; final_grade?: { period_id: string; grade: string | number | null }[] }[] }
export interface SgyEvent { id: string; title: string; description?: string; start?: string; end?: string; type?: string; assignment_id?: string; realm?: string; section_id?: string }

export async function getMe(creds: SchoologyCreds): Promise<SgyUser> {
  return apiGet<SgyUser>(creds, '/users/me');
}

export async function getSections(creds: SchoologyCreds, uid: string): Promise<SgySection[]> {
  const r = await apiGet<{ section: SgySection[] }>(creds, `/users/${uid}/sections`);
  return (r.section ?? []).filter((s) => String(s.active ?? '1') !== '0');
}

export async function getAssignments(creds: SchoologyCreds, sectionId: string): Promise<SgyAssignment[]> {
  const out: SgyAssignment[] = [];
  let start = 0;
  for (let i = 0; i < 20; i++) {
    const r = await apiGet<{ assignment: SgyAssignment[]; total?: string }>(creds, `/sections/${sectionId}/assignments`, { limit: '200', start: String(start) });
    out.push(...(r.assignment ?? []));
    if (!r.assignment || r.assignment.length < 200) break;
    start += 200;
  }
  return out;
}

export async function getGrades(creds: SchoologyCreds, sectionId: string): Promise<SgyGradesResponse> {
  return apiGet<SgyGradesResponse>(creds, `/sections/${sectionId}/grades`);
}

/** "2026-09-21 23:59:00" (Schoology local time) → date-only when 23:59, else ISO local. */
export function dueToTask(due?: string): string | undefined {
  if (!due) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(due);
  if (!m) return undefined;
  if (!m[2] || (m[2] === '23' && m[3] === '59') || (m[2] === '00' && m[3] === '00')) return m[1];
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00`);
  return isNaN(d.getTime()) ? m[1] : d.toISOString();
}

export function stripHtml(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ApiSyncResult {
  assignments: ExternalAssignment[];
  grades: Map<string, { score: number; weight?: number }>; // externalId -> percent score
  sections: { id: string; name: string }[];
  finalGrades: Map<string, number>; // section name -> latest final grade percent
}

/** Pull everything we need for a sync: all sections, their assignments and grades. */
export async function pullAll(creds: SchoologyCreds, domain: string, includeGrades: boolean): Promise<ApiSyncResult> {
  const me = await getMe(creds);
  const sections = await getSections(creds, me.uid);
  const assignments: ExternalAssignment[] = [];
  const grades = new Map<string, { score: number; weight?: number }>();
  const finalGrades = new Map<string, number>();
  const base = (domain || 'https://app.schoology.com').replace(/\/+$/, '');
  for (const s of sections) {
    const name = s.course_title || s.section_title;
    const list = await getAssignments(creds, s.id);
    for (const a of list) {
      const t: TaskType = a.type === 'assessment' || /quiz|test/i.test(a.assignment_type ?? '') ? inferType(a.title) : inferType(a.title);
      assignments.push({
        externalId: `assignment:${a.id}`,
        title: a.title,
        courseName: name,
        dueAt: dueToTask(a.due),
        notes: stripHtml(a.description) || undefined,
        url: a.web_url || `${base}/assignment/${a.id}/info`,
        type: t,
        kind: 'assignment',
      });
    }
    if (includeGrades) {
      try {
        const g = await getGrades(creds, s.id);
        for (const sec of g.section ?? []) {
          for (const p of sec.period ?? []) {
            for (const item of p.assignment ?? []) {
              const max = parseFloat(item.max_points ?? '');
              const got = item.grade === null || item.grade === undefined ? NaN : parseFloat(String(item.grade));
              if (!isNaN(got) && max > 0) grades.set(`assignment:${item.assignment_id}`, { score: Math.round((got / max) * 1000) / 10, weight: undefined });
            }
          }
          const fg = (sec.final_grade ?? []).map((f) => (f.grade === null || f.grade === undefined ? NaN : parseFloat(String(f.grade)))).filter((n) => !isNaN(n));
          if (fg.length) finalGrades.set(name, fg[fg.length - 1]);
        }
      } catch {
        /* grades are optional; a 403 here just means grades are hidden */
      }
    }
  }
  return { assignments, grades, sections: sections.map((s) => ({ id: s.id, name: s.course_title || s.section_title })), finalGrades };
}
