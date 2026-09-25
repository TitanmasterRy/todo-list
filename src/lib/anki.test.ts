import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { zipSync } from 'fflate';
import { fromAnkiText, htmlToText, importApkg, toAnkiText } from './anki';

describe('Anki text', () => {
  it('exports with headers and round-trips', () => {
    const txt = toAnkiText('Bio', [
      { front: 'Mitosis', back: 'Cell division\ninto two' },
      { front: 'a < b', back: 'tab\there' },
    ]);
    expect(txt.split('\n').slice(0, 3)).toEqual(['#separator:tab', '#html:true', '#deck:Bio']);
    expect(txt).toContain('Cell division<br>into two');
    expect(fromAnkiText(txt)).toEqual([
      { front: 'Mitosis', back: 'Cell division\ninto two' },
      { front: 'a < b', back: 'tab here' },
    ]);
  });
  it('reads semicolon files and strips HTML', () => {
    expect(fromAnkiText('#separator:semicolon\n<b>Q</b>;A&amp;B\n')).toEqual([{ front: 'Q', back: 'A&B' }]);
    expect(htmlToText('<div>one</div><div>two&nbsp;x</div>')).toBe('one\ntwo x');
  });
});

describe('.apkg import', () => {
  it('reads decks, basic and cloze notes, and images from a legacy collection', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run('CREATE TABLE col (models TEXT, decks TEXT)');
    db.run('CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)');
    db.run('CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER)');
    db.run('INSERT INTO col VALUES (?, ?)', [JSON.stringify({ 1: { type: 0 }, 2: { type: 1 } }), JSON.stringify({ 10: { name: 'Science::Biology' } })]);
    db.run('INSERT INTO notes VALUES (?, ?, ?)', [100, 1, 'What is <b>ATP</b>?\x1fEnergy currency<br>of cells']);
    db.run('INSERT INTO notes VALUES (?, ?, ?)', [101, 2, 'The {{c1::nucleus}} holds {{c2::DNA}}\x1fExtra info']);
    db.run('INSERT INTO notes VALUES (?, ?, ?)', [102, 1, 'Label this <img src="cell.png">\x1fA cell']);
    for (const [id, nid] of [
      [1, 100],
      [2, 101],
      [3, 101],
      [4, 102],
    ])
      db.run('INSERT INTO cards VALUES (?, ?, 10)', [id, nid]);
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const apkg = zipSync({ 'collection.anki2': db.export(), media: new TextEncoder().encode(JSON.stringify({ 0: 'cell.png' })), 0: png });
    const decks = await importApkg(apkg, SQL);
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe('Biology');
    const cards = decks[0].cards;
    expect(cards[0]).toEqual({ front: 'What is ATP?', back: 'Energy currency\nof cells', frontImage: undefined, backImage: undefined });
    expect(cards.filter((c) => c.front.includes('[…]'))).toHaveLength(2);
    expect(cards[1].back).toContain('Extra info');
    expect(cards[3].frontImage).toMatch(/^data:image\/png;base64,/);
  });
  it('rejects files without a collection', async () => {
    await expect(importApkg(zipSync({ 'readme.txt': new Uint8Array([1]) }))).rejects.toThrow(/no Anki collection/);
  });
});
