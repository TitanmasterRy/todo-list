import { afterEach, describe, expect, it, vi } from 'vitest';
import en from './en';
import es from './es';
import { formatNumber, i18n, locale, resolveLocale, setLocale, t } from './index.svelte';
import type { Message } from './types';

afterEach(async () => {
  await setLocale('en');
  vi.restoreAllMocks();
});

const placeholders = (m: Message) =>
  new Set(
    (typeof m === 'string' ? [m] : Object.values(m))
      .join(' ')
      .match(/\{\w+\}/g)
      ?.filter((p) => p !== '{count}') ?? [],
  );

describe('t()', () => {
  it('interpolates {name} params', () => {
    expect(t('toast.added', { title: 'Essay' })).toBe('Added “Essay”');
    expect(t('nav.level', { level: 3, title: 'Sophomore' })).toBe('Lv 3 · Sophomore');
  });

  it('leaves unknown placeholders alone and returns plain strings without params', () => {
    expect(t('toast.added')).toBe('Added “{title}”');
    expect(t('nav.today')).toBe('Today');
  });

  it('picks plural forms with Intl.PluralRules', () => {
    expect(t('common.tasks', { count: 1 })).toBe('1 task');
    expect(t('common.tasks', { count: 0 })).toBe('0 tasks');
    expect(t('common.tasks', { count: 5 })).toBe('5 tasks');
    expect(t('task.examDays', { count: 1 })).toBe('1 day');
  });

  it('falls back to English with a dev warning when a key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const saved = i18n.dict;
    i18n.dict = { 'nav.today': 'Hoy' };
    try {
      expect(t('nav.today')).toBe('Hoy');
      expect(t('nav.inbox')).toBe('Inbox');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('nav.inbox'));
    } finally {
      i18n.dict = saved;
    }
  });
});

describe('locales', () => {
  it('resolves Auto from the browser languages', () => {
    expect(resolveLocale('auto', ['es-MX', 'en-US'])).toEqual({ locale: 'es', intl: 'es-MX' });
    expect(resolveLocale('auto', ['fr-FR', 'es-ES'])).toEqual({ locale: 'es', intl: 'es-ES' });
    expect(resolveLocale('auto', ['fr-FR', 'de'])).toEqual({ locale: 'en', intl: 'en' });
    expect(resolveLocale('es', ['en-GB'])).toEqual({ locale: 'es', intl: 'es' });
    expect(resolveLocale('es', ['en-GB', 'es-AR'])).toEqual({ locale: 'es', intl: 'es-AR' });
  });

  it('switches language (loading the Spanish file) and back', async () => {
    await setLocale('es', { languages: ['es-ES'] });
    expect(locale()).toBe('es');
    expect(t('nav.today')).toBe('Hoy');
    expect(t('common.tasks', { count: 1 })).toBe('1 tarea');
    expect(t('common.tasks', { count: 3 })).toBe('3 tareas');
    expect(t('toast.added', { title: 'Ensayo' })).toBe('Añadida: “Ensayo”');
    await setLocale('en');
    expect(locale()).toBe('en');
    expect(t('nav.today')).toBe('Today');
  });

  it('keeps the newest switch when two overlap', async () => {
    const a = setLocale('es');
    const b = setLocale('en');
    await Promise.all([a, b]);
    expect(locale()).toBe('en');
  });

  it('sets the text direction', async () => {
    await setLocale('en', { forceRtl: true });
    expect(i18n.dir).toBe('rtl');
    await setLocale('en');
    expect(i18n.dir).toBe('ltr');
  });

  it('formats numbers for the region', async () => {
    expect(formatNumber(1234)).toBe('1,234');
    await setLocale('es', { languages: ['es-ES'] });
    expect(formatNumber(12345)).toBe('12.345');
  });
});

describe('Spanish file', () => {
  it('has every English key with the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(es[key], key).toBeDefined();
      expect([...placeholders(es[key])].sort(), key).toEqual([...placeholders(en[key])].sort());
    }
    expect(Object.keys(es).length).toBe(Object.keys(en).length);
  });
});
