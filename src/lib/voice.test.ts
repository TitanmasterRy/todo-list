import { describe, expect, it } from 'vitest';
import { voiceToQuickAdd } from './voice';
import { parseQuickAdd } from './parser';

describe('voice commands', () => {
  it('turns speech into quick-add syntax', () => {
    expect(voiceToQuickAdd('Hey, add read chapter four for tomorrow')).toBe('read chapter 4 tomorrow');
    expect(voiceToQuickAdd('Remind me to email Ms. Lee by Friday at three thirty p.m.')).toBe('email Ms. Lee Friday at 3:30pm');
    expect(voiceToQuickAdd('band practice at five oh five pm')).toBe('band practice at 5:05pm');
    expect(voiceToQuickAdd('call at 3 30 PM')).toBe('call at 3:30pm');
    expect(voiceToQuickAdd('add a task study for the bio test it takes forty five minutes, high priority, hashtag bio')).toBe('study for the bio test ~45m !high #bio');
    expect(voiceToQuickAdd('I need to finish the lab report due Monday at 5 PM.')).toBe('finish the lab report Monday at 5pm');
    expect(voiceToQuickAdd('practice piano for an hour tonight')).toBe('practice piano ~60m tonight');
    expect(voiceToQuickAdd('Read the second chapter')).toBe('Read the 2nd chapter');
    expect(voiceToQuickAdd('a quiz on twenty five words')).toBe('a quiz on 25 words');
    expect(voiceToQuickAdd('it is urgent call mom')).toBe('it is !urgent call mom');
  });
  it('produces text the parser understands', () => {
    const p = parseQuickAdd(voiceToQuickAdd('Hey homework, add read chapter four for tomorrow at five p.m. high priority, it takes thirty minutes'), {
      now: new Date(2026, 9, 5, 9, 0),
    });
    expect(p.title).toBe('read chapter 4');
    expect(p.priority).toBe('high');
    expect(p.estimateMin).toBe(30);
    expect(p.dueAt && new Date(p.dueAt).getDate()).toBe(6);
    expect(p.dueAt && new Date(p.dueAt).getHours()).toBe(17);
  });
});
