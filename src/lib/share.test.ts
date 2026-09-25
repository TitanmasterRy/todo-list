import { describe, expect, it } from 'vitest';
import { isPdf, titleForShare } from './share';

describe('share into the app', () => {
  it('names the task from the share or the file', () => {
    const f = new File(['x'], 'chem_worksheet-3.pdf', { type: 'application/pdf' });
    expect(titleForShare([f], {})).toBe('chem worksheet 3');
    expect(titleForShare([f], { title: 'Worksheet 3 due fri' })).toBe('Worksheet 3 due fri');
    expect(titleForShare([], {})).toBe('Shared file');
    expect(isPdf(f)).toBe(true);
    expect(isPdf(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false);
  });
});
