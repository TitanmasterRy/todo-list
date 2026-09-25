// Essay statistics: counts, page and time estimates, readability, and gentle style flags.

const STOP = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they me him her us them my your his our their not no so do does did have has had will would can could should may might must there here than then what which who whom whose when where why how all any each few more most other some such only own same too very just also into over under about after before again further once up down out off above below between both through during while'.split(
    ' ',
  ),
);
const FILLERS = [
  'very',
  'really',
  'just',
  'actually',
  'basically',
  'literally',
  'totally',
  'quite',
  'somewhat',
  'kind of',
  'sort of',
  'a lot',
  'in order to',
  'due to the fact that',
  'at this point in time',
];

export interface EssayStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  avgSentenceWords: number;
  readingMin: number;
  speakingMin: number;
  pagesDouble: number;
  pagesSingle: number;
  fleschEase: number; // 0–100, higher is easier
  gradeLevel: number; // Flesch–Kincaid grade
  topWords: { word: string; count: number }[];
  longSentences: string[];
  passive: string[];
  fillers: { word: string; count: number }[];
}

export function words(text: string): string[] {
  return text.match(/[A-Za-zÀ-ÿ0-9]+(?:['’-][A-Za-zÀ-ÿ0-9]+)*/g) ?? [];
}

export function splitSentences(text: string): string[] {
  return (
    text
      .replace(/\s+/g, ' ')
      .match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g)
      ?.map((s) => s.trim())
      .filter((s) => words(s).length > 0) ?? []
  );
}

/** Syllables by vowel groups, with the usual silent-e and -le adjustments. Good enough for readability scores. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function analyzeEssay(text: string): EssayStats {
  const ws = words(text);
  const sents = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => words(p).length > 0).length;
  const nw = ws.length;
  const ns = Math.max(1, sents.length);
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  const counts = new Map<string, number>();
  for (const w of ws) {
    const k = w.toLowerCase();
    if (k.length < 3 || STOP.has(k) || /^\d+$/.test(k)) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const fillers = FILLERS.map((f) => ({ word: f, count: lower.split(new RegExp(`\\b${f}\\b`)).length - 1 })).filter((f) => f.count > 0);
  const passive = sents.filter((s) => /\b(am|is|are|was|were|be|been|being)\s+(\w+ly\s+)?\w+(ed|en)\b/i.test(s) && !/\b(is|are|was|were)\s+(used to|going|seen as)\b/i.test(s));
  return {
    words: nw,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    sentences: sents.length,
    paragraphs,
    avgSentenceWords: nw ? round1(nw / ns) : 0,
    readingMin: round1(nw / 238),
    speakingMin: round1(nw / 130),
    pagesDouble: round1(nw / 275),
    pagesSingle: round1(nw / 550),
    fleschEase: nw ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (nw / ns) - 84.6 * (syl / nw)))) : 0,
    gradeLevel: nw ? Math.max(0, round1(0.39 * (nw / ns) + 11.8 * (syl / nw) - 15.59)) : 0,
    topWords: [...counts.entries()]
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([word, count]) => ({ word, count })),
    longSentences: sents.filter((s) => words(s).length > 30),
    passive,
    fillers,
  };
}

export function easeLabel(score: number): string {
  if (score >= 80) return 'Easy (grade 5–6)';
  if (score >= 70) return 'Fairly easy (grade 7)';
  if (score >= 60) return 'Plain English (grades 8–9)';
  if (score >= 50) return 'Fairly hard (grades 10–12)';
  if (score >= 30) return 'Hard (college)';
  return 'Very hard (graduate)';
}
