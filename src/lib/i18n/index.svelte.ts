// Tiny typed i18n layer. en.ts is the source of truth for keys (MessageKey); every language, English included, is its
// own chunk loaded on demand, so the first download carries no strings and English users never fetch Spanish.
// store.init() waits for the language before the app renders. t() reads reactive state, so components re-render when
// the language changes. Missing keys fall back to English (with a warning in dev).
import type { MessageKey } from './en';
import type { Message, Params, PluralMessage } from './types';

export type { MessageKey } from './en';
export type Locale = 'en' | 'es';
export type LocalePref = 'auto' | Locale;
export type Dict = Record<MessageKey, Message>;

export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];
const loaders: Record<Locale, () => Promise<{ default: Partial<Dict> }>> = {
  en: () => import('./en'),
  es: () => import('./es'),
};
// languages written right to left (none are translated yet; the layout supports them)
const RTL_LANGS = new Set(['ar', 'fa', 'he', 'ur', 'yi', 'ps']);

class I18nState {
  locale = $state<Locale>('en');
  intl = $state('en'); // BCP 47 tag used for Intl formatting (keeps the browser's region, e.g. es-MX)
  dir = $state<'ltr' | 'rtl'>('ltr');
  dict = $state.raw<Partial<Dict>>({});
}
export const i18n = new I18nState();
// English, kept as the fallback once loaded
let english: Partial<Dict> | undefined;

/** Current language (reactive). */
export function locale(): Locale {
  return i18n.locale;
}

/** Tag for Intl formatters (reactive). */
export function intlLocale(): string {
  return i18n.intl;
}

/** Pick a supported language from a preference and the browser's language list. */
export function resolveLocale(pref: LocalePref, languages: readonly string[] = browserLanguages()): { locale: Locale; intl: string } {
  if (pref !== 'auto') {
    const regional = languages.find((l) => l.toLowerCase().split('-')[0] === pref);
    return { locale: pref, intl: regional ?? pref };
  }
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (LOCALES.some((l) => l.id === base)) return { locale: base as Locale, intl: tag };
  }
  return { locale: 'en', intl: 'en' };
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return ['en'];
  return navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
}

let loadToken = 0;
/** Switch language (loading its file if needed) and update <html lang dir>. */
export async function setLocale(pref: LocalePref, opts: { forceRtl?: boolean; languages?: readonly string[] } = {}): Promise<void> {
  let { locale: next, intl } = resolveLocale(pref, opts.languages);
  const token = ++loadToken;
  english ??= (await loaders.en()).default;
  let dict = english;
  if (next !== 'en') {
    try {
      dict = (await loaders[next]()).default;
    } catch (e) {
      console.warn(`Could not load the ${next} translation`, e);
      [next, intl] = ['en', 'en'];
    }
  }
  if (token !== loadToken) return; // a newer switch won
  i18n.dict = dict;
  i18n.locale = next;
  i18n.intl = intl;
  i18n.dir = opts.forceRtl || RTL_LANGS.has(intl.toLowerCase().split('-')[0]) ? 'rtl' : 'ltr';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = intl;
    document.documentElement.dir = i18n.dir;
  }
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(n: number, tag: string): Intl.LDMLPluralRule {
  let pr = pluralRules.get(tag);
  if (!pr) pluralRules.set(tag, (pr = new Intl.PluralRules(tag)));
  return pr.select(n);
}

/** Is this string a known message key? (for keys built from data, like quest ids) */
export function hasKey(key: string): key is MessageKey {
  return !!english && key in english;
}

const warned = new Set<string>();
/** Translate a key. `{name}` placeholders are filled from params; plural messages pick a form from `params.count`. */
export function t(key: MessageKey, params?: Params): string {
  let msg: Message | undefined = i18n.dict[key];
  if (msg === undefined && english) {
    msg = english[key];
    if (import.meta.env?.DEV && !warned.has(`${i18n.locale}:${key}`)) {
      warned.add(`${i18n.locale}:${key}`);
      console.warn(`[i18n] "${key}" is missing in ${i18n.locale}; using English`);
    }
  }
  if (msg === undefined) return key; // nothing loaded yet
  if (typeof msg !== 'string') {
    const n = Number(params?.count ?? 0);
    const forms = msg as PluralMessage;
    msg = (n === 0 && forms.zero) || forms[pluralCategory(n, i18n.locale)] || forms.other;
  }
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

const numberFormats = new Map<string, Intl.NumberFormat>();
/** Locale-aware number ("1,234" / "1234" / "1.234"). */
export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  const id = `${i18n.intl}|${opts ? JSON.stringify(opts) : ''}`;
  let nf = numberFormats.get(id);
  if (!nf) numberFormats.set(id, (nf = new Intl.NumberFormat(i18n.intl, opts)));
  return nf.format(n);
}
