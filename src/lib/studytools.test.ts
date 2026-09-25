import { describe, expect, it } from 'vitest';
import { analyzeEssay, easeLabel, syllables } from './essay';
import { convert, formatNumber } from './units';
import { citationHTML, citationText, extractDOI, extractISBN, formatCitation, fromCrossref, fromOpenLibrary, splitName, type Source } from './citations';

describe('essay stats', () => {
  it('counts words, sentences and paragraphs', () => {
    const s = analyzeEssay('The cell is the basic unit of life. Cells divide!\n\nMitosis makes two cells. It was studied by many scientists.');
    expect(s.words).toBe(20);
    expect(s.sentences).toBe(4);
    expect(s.paragraphs).toBe(2);
    expect(s.topWords[0]).toEqual({ word: 'cells', count: 2 });
    expect(s.passive).toHaveLength(1);
  });
  it('scores simple text as easier than dense text', () => {
    const easy = analyzeEssay('The cat sat on the mat. The dog ran to the park. We had fun.');
    const hard = analyzeEssay(
      'Photosynthetic organisms utilize electromagnetic radiation, transforming atmospheric carbon dioxide into carbohydrates through biochemical processes.',
    );
    expect(easy.fleschEase).toBeGreaterThan(hard.fleschEase);
    expect(hard.gradeLevel).toBeGreaterThan(easy.gradeLevel);
    expect(easeLabel(90)).toContain('Easy');
  });
  it('estimates syllables and finds fillers', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('table')).toBe(2);
    expect(syllables('education')).toBe(4);
    expect(analyzeEssay('It is very very good and really just fine.').fillers.map((f) => f.word)).toEqual(['very', 'really', 'just']);
  });
  it('handles empty text', () => {
    expect(analyzeEssay('').words).toBe(0);
  });
});

describe('units', () => {
  it('converts length, mass and data', () => {
    expect(convert(1, 'length', 'mi', 'km')).toBeCloseTo(1.609344, 6);
    expect(convert(5280, 'length', 'ft', 'mi')).toBeCloseTo(1, 9);
    expect(convert(1, 'mass', 'lb', 'kg')).toBeCloseTo(0.45359237, 8);
    expect(convert(1, 'data', 'gib', 'mb')).toBeCloseTo(1073.741824, 6);
  });
  it('converts temperature', () => {
    expect(convert(100, 'temperature', 'c', 'f')).toBeCloseTo(212);
    expect(convert(32, 'temperature', 'f', 'k')).toBeCloseTo(273.15);
    expect(convert(0, 'temperature', 'k', 'c')).toBeCloseTo(-273.15);
  });
  it('formats numbers readably', () => {
    expect(formatNumber(1.6093440000001)).toBe('1.60934');
    expect(formatNumber(9.46e15)).toBe('9.46 × 10^15');
    expect(formatNumber(NaN)).toBe('—');
  });
});

describe('citations', () => {
  const article: Source = {
    type: 'article',
    authors: [
      { given: 'Jane', family: 'Doe' },
      { given: 'John Q', family: 'Smith' },
    ],
    title: 'Cells and Stuff',
    container: 'Journal of Biology',
    year: '2020',
    volume: '12',
    issue: '3',
    pages: '45–67',
    doi: '10.1234/jb.2020.12',
  };
  const book: Source = { type: 'book', authors: [{ given: 'Ada', family: 'Lovelace' }], title: 'Notes on the Engine', publisher: 'Penguin', place: 'London', year: '1843' };
  it('MLA', () => {
    expect(citationText(formatCitation(article, 'mla'))).toBe(
      'Doe, Jane, and John Q Smith. “Cells and Stuff.” Journal of Biology, vol. 12, no. 3, 2020, pp. 45–67. https://doi.org/10.1234/jb.2020.12.',
    );
    expect(citationText(formatCitation(book, 'mla'))).toBe('Lovelace, Ada. Notes on the Engine. Penguin, 1843.');
    expect(citationHTML(formatCitation(book, 'mla'))).toContain('<i>Notes on the Engine.</i>');
  });
  it('APA', () => {
    expect(citationText(formatCitation(article, 'apa'))).toBe(
      'Doe, J., & Smith, J. Q. (2020). Cells and Stuff. Journal of Biology, 12(3), 45–67. https://doi.org/10.1234/jb.2020.12',
    );
    expect(citationText(formatCitation(book, 'apa'))).toBe('Lovelace, A. (1843). Notes on the Engine. Penguin.');
  });
  it('Chicago', () => {
    expect(citationText(formatCitation(article, 'chicago'))).toBe(
      'Doe, Jane, and John Q Smith. “Cells and Stuff.” Journal of Biology 12, no. 3 (2020): 45–67. https://doi.org/10.1234/jb.2020.12.',
    );
    expect(citationText(formatCitation(book, 'chicago'))).toBe('Lovelace, Ada. Notes on the Engine. London: Penguin, 1843.');
  });
  it('websites and many authors', () => {
    const web: Source = {
      type: 'website',
      authors: [],
      title: 'How Volcanoes Work',
      container: 'NASA',
      year: '2024',
      month: 3,
      day: 5,
      url: 'https://nasa.gov/v',
      accessed: '2026-09-20',
    };
    expect(citationText(formatCitation(web, 'mla'))).toBe('“How Volcanoes Work.” NASA, 5 Mar. 2024, https://nasa.gov/v. Accessed 20 Sept. 2026.');
    const many = { ...article, authors: [...article.authors, { given: 'Kim', family: 'Lee' }] };
    expect(citationText(formatCitation(many, 'mla'))).toMatch(/^Doe, Jane, et al\. /);
  });
  it('parses lookups and identifiers', () => {
    const s = fromCrossref({
      type: 'journal-article',
      title: ['A Study'],
      author: [{ given: 'Ann', family: 'Bee' }],
      'container-title': ['Nature'],
      issued: { 'date-parts': [[2021, 6]] },
      volume: '5',
      page: '1-9',
      DOI: '10.1/x',
    });
    expect(s).toMatchObject({ type: 'article', title: 'A Study', container: 'Nature', year: '2021', month: 6, pages: '1–9' });
    expect(fromOpenLibrary({ title: 'Dune', authors: [{ name: 'Frank Herbert' }], publishers: [{ name: 'Chilton' }], publish_date: 'August 1965' })).toMatchObject({
      authors: [{ given: 'Frank', family: 'Herbert' }],
      year: '1965',
    });
    expect(extractDOI('see https://doi.org/10.1038/nature12373.')).toBe('10.1038/nature12373');
    expect(extractISBN('ISBN 978-0-441-17271-9')).toBe('9780441172719');
    expect(splitName('Herbert, Frank')).toEqual({ given: 'Frank', family: 'Herbert' });
  });
});
