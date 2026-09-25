import { describe, expect, it } from 'vitest';
import { WrongPassphraseError } from './crypto';
import { createVault, dropSlots, openVault, parseVaultFile, rewriteVault, storedSlots } from './vault';
import { pickSecrets, readSlot, secretsPatch, stripSecrets, touchesSecrets, withoutSecrets } from './secretSlots';
import { DEFAULT_SETTINGS, type Settings } from './types';

describe('key vault file', () => {
  it('stores each secret encrypted and opens with the passphrase only', async () => {
    const { file } = await createVault('hunter2hunter2', { gistToken: 'ghp_abc', 'aiKeys.gemini': 'AIza123' });
    const raw = JSON.stringify(file);
    expect(raw).not.toContain('ghp_abc');
    expect(raw).not.toContain('AIza123');
    expect(storedSlots(file).sort()).toEqual(['aiKeys.gemini', 'gistToken']);
    const parsed = parseVaultFile(raw)!;
    expect((await openVault(parsed, 'hunter2hunter2')).values).toEqual({ gistToken: 'ghp_abc', 'aiKeys.gemini': 'AIza123' });
    await expect(openVault(parsed, 'wrong')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('an empty vault still tells a wrong passphrase apart', async () => {
    const { file } = await createVault('right passphrase', {});
    await expect(openVault(file, 'left passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);
    expect((await openVault(file, 'right passphrase')).values).toEqual({});
  });

  it('rewrites with the same key, and drops slots without it', async () => {
    const { file, key } = await createVault('pass phrase', { gistToken: 'a' });
    const next = await rewriteVault(file, key, { gistToken: 'b', schoologyKey: 'k' });
    expect(next.salt).toBe(file.salt);
    expect((await openVault(next, 'pass phrase')).values).toEqual({ gistToken: 'b', schoologyKey: 'k' });
    expect(storedSlots(dropSlots(next, ['gistToken']))).toEqual(['schoologyKey']);
  });

  it('ignores junk, weak settings and unknown slots when reading', async () => {
    expect(parseVaultFile(null)).toBeNull();
    expect(parseVaultFile('not json')).toBeNull();
    const { file } = await createVault('pass phrase', { gistToken: 'a' });
    expect(parseVaultFile(JSON.stringify({ ...file, iter: 1000 }))).toBeNull();
    const withJunk = parseVaultFile(JSON.stringify({ ...file, items: { ...file.items, evil: file.items.gistToken, 'aiKeys.x': 5 } }))!;
    expect(storedSlots(withJunk)).toEqual(['gistToken']);
  });
});

describe('secret slots', () => {
  const s: Settings = { ...DEFAULT_SETTINGS, gistToken: 'ghp', aiKeys: { anthropic: 'sk-ant', groq: '' }, schoologySecret: 'sec', theme: 'dark' };

  it('flattens secrets into slots and back', () => {
    expect(pickSecrets(s)).toEqual({ gistToken: 'ghp', 'aiKeys.anthropic': 'sk-ant', schoologySecret: 'sec' });
    expect(readSlot(s, 'aiKeys.anthropic')).toBe('sk-ant');
    expect(readSlot(s, 'aiKeys.openai')).toBe('');
    const patch = secretsPatch(s, { 'aiKeys.openai': 'sk-oa', 'aiKeys.anthropic': '', gistToken: 'new' });
    expect(patch).toEqual({ gistToken: 'new', aiKeys: { openai: 'sk-oa', groq: '' } });
  });

  it('blanks secrets for disk and never takes them from an import', () => {
    const disk = stripSecrets(s);
    expect(pickSecrets(disk)).toEqual({});
    expect(disk.theme).toBe('dark');
    const imported = withoutSecrets({ theme: 'light', gistToken: 'evil', aiKeys: { openai: 'x' }, syncPassphrase: 'p' });
    expect(imported).toEqual({ theme: 'light' });
  });

  it('knows which patches touch secrets', () => {
    expect(touchesSecrets({ theme: 'dark' })).toBe(false);
    expect(touchesSecrets({ aiKeys: {} })).toBe(true);
    expect(touchesSecrets({ syncPassphrase: '' })).toBe(true);
  });
});
