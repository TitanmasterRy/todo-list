import { describe, expect, it } from 'vitest';
import { asChoice, fromCards, isComplete, parseQuizText, toBlooket, toGimkit, toKahoot, toQTI, toQTIZip, toQuizlet, toWorksheet, type QuizSet } from './quizmaker';

const set: QuizSet = {
  id: 'set1',
  title: 'Cells',
  subject: 'Biology',
  difficulty: 'easy',
  createdAt: '',
  updatedAt: '',
  questions: [
    { id: 'a', type: 'mc', prompt: 'Powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'], correct: [1], explanation: 'ATP is made there.' },
    { id: 'b', type: 'tf', prompt: 'Plants have cell walls.', options: ['True', 'False'], correct: [0] },
    { id: 'c', type: 'short', prompt: 'Jelly-like fluid inside a cell', options: [], correct: [], answer: 'cytoplasm' },
    { id: 'd', type: 'mc', prompt: '', options: ['x', 'y'], correct: [0] },
  ],
};

describe('quizmaker exports', () => {
  it('validates completeness', () => {
    expect(set.questions.map(isComplete)).toEqual([true, true, true, false]);
  });
  it('quizlet tsv', () => {
    const t = toQuizlet(set.questions);
    expect(t.split('\n').length).toBe(3);
    expect(t).toContain('Powerhouse of the cell?\tMitochondria');
    expect(t).toContain('cytoplasm');
  });
  it('blooket csv with 1-based correct answers', () => {
    const c = toBlooket(set.questions);
    expect(c.split('\r\n')[1]).toBe('1,Powerhouse of the cell?,Nucleus,Mitochondria,Ribosome,Golgi,20,2');
    expect(c).toContain('2,Plants have cell walls.,True,False,,,20,1');
  });
  it('gimkit csv puts the correct answer second', () => {
    const c = toGimkit(set.questions);
    expect(c.split('\r\n')[1]).toBe('Powerhouse of the cell?,Mitochondria,Nucleus,Ribosome,Golgi');
  });
  it('kahoot csv and quoting', () => {
    const c = toKahoot([{ id: 'x', type: 'mc', prompt: 'Say "hi", ok?', options: ['a', 'b'], correct: [1] }]);
    expect(c).toContain('"Say ""hi"", ok?",a,b,,,20,2');
  });
  it('short answers become choices with distractors', () => {
    const pool = [set.questions[2], { id: 'e', type: 'short', prompt: 'x', options: [], correct: [], answer: 'nucleus' } as const];
    const r = asChoice(set.questions[2], pool as never);
    expect(r.options).toEqual(['cytoplasm', 'nucleus']);
    expect(r.correct).toEqual([0]);
  });
  it('worksheet with key', () => {
    const w = toWorksheet(set);
    expect(w).toContain('**1.** Powerhouse of the cell?');
    expect(w).toContain('B) Mitochondria');
    expect(w).toContain('## Answer key');
    expect(w).toContain('1. B (Mitochondria) — ATP is made there.');
  });
  it('cards → questions with distractors', () => {
    const qs = fromCards([{ front: 'a', back: '1' }, { front: 'b', back: '2' }, { front: 'c', back: '3' }]);
    expect(qs.length).toBe(3);
    expect([...qs[0].options].sort()).toEqual(['1', '2', '3']);
    expect(qs[0].options[qs[0].correct[0]]).toBe('1');
  });
  it('QTI 1.2 xml and zip', () => {
    const x = toQTI(set);
    expect(x).toContain('<questestinterop');
    expect(x).toContain('multiple_choice_question');
    expect(x).toContain('true_false_question');
    expect(x).toContain('short_answer_question');
    expect(x).toContain('<varequal respident="response1">item_1_1</varequal>');
    expect(x).not.toContain('item_4');
    const zip = toQTIZip(set);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    const txt = new TextDecoder().decode(zip);
    expect(txt).toContain('imsmanifest.xml');
    expect(txt).toContain('set1.xml');
  });
  it('parses pasted quiz text', () => {
    const qs = parseQuizText('1. Capital of France?\nA) Berlin\nB) Paris*\nC) Rome\n\nQ: 2+2\nA: 4');
    expect(qs.length).toBe(2);
    expect(qs[0].correct).toEqual([1]);
    expect(qs[1].answer).toBe('4');
  });
});
