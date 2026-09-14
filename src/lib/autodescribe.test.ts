import { describe, expect, it } from 'vitest';
import { autoDescribe, inferSubject } from './autodescribe';

describe('autoDescribe', () => {
  describe('reading', () => {
    it('detects reading and parses page ranges', () => {
      const d = autoDescribe('Read pp. 112-140', { courseName: 'Chem' });
      expect(d.type).toBe('reading');
      expect(d.subtasks[0]).toBe('Skim headings pp. 112–140');
      expect(d.subtasks).toContain('Read and annotate');
      expect(d.subtasks).toContain('Write 5 bullet summary');
      expect(d.estimateMin).toBe(29 * 3);
      expect(d.tags).toEqual(['reading']);
      expect(d.notes).toContain('Reading for Chem: pp. 112–140.');
      expect(d.notes).toContain('**Plan:**');
      expect(d.notes).toContain('**Tip:** Track units through each step.');
    });
    it('handles unicode dashes and "pages"', () => {
      const d = autoDescribe('pages 12–40 of the textbook');
      expect(d.type).toBe('reading');
      expect(d.estimateMin).toBe(29 * 3);
      expect(d.subtasks[0]).toContain('pp. 12–40');
    });
    it('detects chapters', () => {
      const d = autoDescribe('Ch 4 kinetics');
      expect(d.type).toBe('reading');
      expect(d.notes).toContain('chapter 4');
      expect(d.estimateMin).toBe(45);
    });
    it('detects articles and novels', () => {
      expect(autoDescribe('Article on the French Revolution').type).toBe('reading');
      expect(autoDescribe('Finish the novel').type).toBe('reading');
    });
    it('clamps estimates', () => {
      expect(autoDescribe('Read pp. 1-400').estimateMin).toBe(300);
      expect(autoDescribe('Read p. 4').estimateMin).toBe(15);
    });
  });

  describe('exam and quiz', () => {
    it('detects quiz', () => {
      const d = autoDescribe('Vocab quiz');
      expect(d.type).toBe('quiz');
      expect(d.estimateMin).toBe(45);
      expect(d.subtasks.length).toBeGreaterThanOrEqual(4);
      expect(d.subtasks.join(' ')).toMatch(/notecard/i);
      expect(d.notes).toMatch(/spaced practice beats cramming/i);
      expect(d.tags).toEqual(['study']);
    });
    it('detects exam, midterm, final, test', () => {
      expect(autoDescribe('Midterm').type).toBe('exam');
      expect(autoDescribe('Final!').type).toBe('exam');
      expect(autoDescribe('Unit 3 test').type).toBe('exam');
      const d = autoDescribe('Chem exam');
      expect(d.type).toBe('exam');
      expect(d.estimateMin).toBe(90);
      expect(d.subtasks.join(' ')).toMatch(/sleep/i);
    });
  });

  describe('writing and projects', () => {
    it('detects essays', () => {
      const d = autoDescribe('Essay on Gatsby', { courseName: 'English 10' });
      expect(d.type).toBe('project');
      expect(d.estimateMin).toBe(120);
      expect(d.subtasks[0]).toMatch(/thesis/i);
      expect(d.subtasks.join(' ')).toMatch(/proofread/i);
      expect(d.notes).toContain('State your claim in one sentence first.');
      expect(d.tags).toEqual(['writing']);
    });
    it('detects presentations', () => {
      const d = autoDescribe('Slides for the group presentation');
      expect(d.type).toBe('project');
      expect(d.subtasks.join(' ')).toMatch(/rehearse/i);
    });
    it('treats lab report as a project, not a lab', () => {
      const d = autoDescribe('Lab report: titration');
      expect(d.type).toBe('project');
      expect(d.tags).toEqual(['writing']);
    });
    it('uses the generic writing tip when there is no subject', () => {
      const d = autoDescribe('Write the draft');
      expect(d.notes).toContain('Write the thesis first, then cite as you go.');
    });
  });

  describe('homework', () => {
    it('detects problem sets and counts problems', () => {
      const d = autoDescribe('Problem set 3, problems 1–20', { courseName: 'Calc II' });
      expect(d.type).toBe('homework');
      expect(d.subtasks[0]).toBe('Do problems 1–20');
      expect(d.subtasks).toContain('Check answers');
      expect(d.estimateMin).toBe(80);
      expect(d.notes).toContain('Show every step; check by plugging back in.');
      expect(d.subject).toBe('math');
    });
    it('detects hash ranges and bare ranges', () => {
      expect(autoDescribe('#1-15').type).toBe('homework');
      expect(autoDescribe('#1-15').estimateMin).toBe(60);
      const bare = autoDescribe('Worksheet 4-9');
      expect(bare.type).toBe('homework');
      expect(bare.estimateMin).toBe(24);
    });
    it('uses the default estimate without counts', () => {
      const d = autoDescribe('hw');
      expect(d.type).toBe('homework');
      expect(d.estimateMin).toBe(60);
      expect(d.subtasks[0]).toBe('Do the problems');
    });
    it('detects worksheets, exercises and practice', () => {
      expect(autoDescribe('Worksheet').type).toBe('homework');
      expect(autoDescribe('Exercises 2, 4, 6').type).toBe('homework');
      expect(autoDescribe('Exercises 2, 4, 6').estimateMin).toBe(15);
      expect(autoDescribe('Practice').type).toBe('homework');
    });
  });

  describe('lab and study', () => {
    it('detects labs as homework with lab tag', () => {
      const d = autoDescribe('Titration lab', { courseName: 'Chemistry' });
      expect(d.type).toBe('homework');
      expect(d.tags).toEqual(['lab']);
      expect(d.subtasks.join(' ')).toMatch(/procedure/i);
      expect(d.notes).toContain('Track units through each step.');
    });
    it('detects study sessions as other with study tag', () => {
      const d = autoDescribe('Review flashcards');
      expect(d.type).toBe('other');
      expect(d.tags).toEqual(['study']);
      expect(d.estimateMin).toBe(30);
    });
    it('falls back to other', () => {
      const d = autoDescribe('Bring permission slip');
      expect(d.type).toBe('other');
      expect(d.tags).toEqual([]);
      expect(d.subtasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('context', () => {
    it('preserves a given type', () => {
      const d = autoDescribe('Read chapter 5', { type: 'homework' });
      expect(d.type).toBe('homework');
      expect(d.subtasks[0]).toBe('Do the problems');
    });
    it('preserves a given type even with quiz keywords', () => {
      const d = autoDescribe('Quiz corrections', { type: 'project' });
      expect(d.type).toBe('project');
      expect(d.estimateMin).toBe(120);
    });
    it('uses a given estimate', () => {
      expect(autoDescribe('Read pp. 1-100', { estimateMin: 25 }).estimateMin).toBe(25);
    });
    it('is deterministic', () => {
      const a = autoDescribe('Read pp. 12-40', { courseName: 'History' });
      const b = autoDescribe('Read pp. 12-40', { courseName: 'History' });
      expect(a).toEqual(b);
    });
    it('keeps notes short with no headings', () => {
      const d = autoDescribe('A very long essay title '.repeat(20));
      expect(d.notes.length).toBeLessThanOrEqual(400);
      expect(d.notes).not.toMatch(/^#/m);
      expect(d.notes.split('\n').length).toBeGreaterThanOrEqual(2);
      expect(d.notes.split('\n').length).toBeLessThanOrEqual(5);
    });
  });

  describe('subject tips', () => {
    it.each([
      ['Calc II', 'math', 'Show every step; check by plugging back in.'],
      ['AP Physics', 'science', 'Track units through each step.'],
      ['English Lit', 'english', 'State your claim in one sentence first.'],
      ['US History', 'history', 'Note dates and causes → effects.'],
      ['Spanish 3', 'language', 'Say the vocabulary out loud.'],
      ['Intro to CS', 'cs', 'Run the smallest piece first.'],
    ])('%s → %s', (course, subject, tip) => {
      const d = autoDescribe('Homework', { courseName: course });
      expect(d.subject).toBe(subject);
      expect(d.notes).toContain(`**Tip:** ${tip}`);
    });
    it('art has no subject tip', () => {
      const d = autoDescribe('Sketch homework', { courseName: 'Art' });
      expect(d.subject).toBe('art');
      expect(d.notes).toContain('**Tip:** Try each problem');
    });
  });
});

describe('inferSubject', () => {
  it('maps course names', () => {
    expect(inferSubject('Algebra 2')).toBe('math');
    expect(inferSubject('Geometry')).toBe('math');
    expect(inferSubject('AP Stats')).toBe('math');
    expect(inferSubject('Chem 101')).toBe('science');
    expect(inferSubject('Biology')).toBe('science');
    expect(inferSubject('Writing Workshop')).toBe('english');
    expect(inferSubject('AP Gov')).toBe('history');
    expect(inferSubject('Econ')).toBe('history');
    expect(inferSubject('Social Studies')).toBe('history');
    expect(inferSubject('French II')).toBe('language');
    expect(inferSubject('Latin')).toBe('language');
    expect(inferSubject('Computer Science')).toBe('cs');
    expect(inferSubject('Programming')).toBe('cs');
    expect(inferSubject('Music Theory')).toBe('art');
  });
  it('is case-insensitive and tolerant of punctuation', () => {
    expect(inferSubject('CHEM.')).toBe('science');
    expect(inferSubject('calc-ii')).toBe('math');
  });
  it('falls back to the title', () => {
    expect(inferSubject(undefined, 'Physics problem set')).toBe('science');
  });
  it('returns other for unknown course, undefined for nothing', () => {
    expect(inferSubject('Homeroom')).toBe('other');
    expect(inferSubject()).toBeUndefined();
    expect(inferSubject('', 'Bring snacks')).toBeUndefined();
  });
});
