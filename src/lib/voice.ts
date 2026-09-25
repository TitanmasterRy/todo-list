// Voice commands for quick add: turn what people say ("Hey, add read chapter four for tomorrow at five p.m.,
// high priority") into quick-add syntax ("read chapter 4 tomorrow at 5pm !high") that the parser understands.

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORDINALS: Record<string, string> = {
  first: '1st',
  second: '2nd',
  third: '3rd',
  fourth: '4th',
  fifth: '5th',
  sixth: '6th',
  seventh: '7th',
  eighth: '8th',
  ninth: '9th',
  tenth: '10th',
};

/** "twenty five" → 25, "four" → 4, "a hundred" → 100 (up to 999). */
function numbersToDigits(s: string): string {
  const words = Object.keys(ONES).concat(Object.keys(TENS), ['hundred']).join('|');
  const re = new RegExp(`\\b(?:(?:a|${words})(?:[\\s-]+(?:and\\s+)?(?:${words}))*)\\b`, 'gi');
  return s.replace(re, (m) => {
    const parts = m
      .toLowerCase()
      .split(/[\s-]+/)
      .filter((w) => w !== 'and');
    if (parts.length === 1 && parts[0] === 'a') return m;
    let total = 0;
    let cur = 0;
    for (const w of parts) {
      if (w === 'a') cur = cur || 1;
      else if (w in ONES) cur += ONES[w];
      else if (w in TENS) cur += TENS[w];
      else if (w === 'hundred') cur = (cur || 1) * 100;
    }
    total += cur;
    return String(total);
  });
}

/** "three thirty p.m." → "3:30 p.m.", "five oh five pm" → "5:05 pm", "3 30 pm" → "3:30 pm" (before numbers are joined up). */
function spokenTimes(s: string): string {
  const hours = Object.keys(ONES)
    .filter((w) => ONES[w] >= 1 && ONES[w] <= 12)
    .join('|');
  const tens = 'twenty|thirty|forty|fifty';
  const units = Object.keys(ONES)
    .filter((w) => ONES[w] >= 1 && ONES[w] <= 9)
    .join('|');
  const re = new RegExp(`\\b(${hours}|\\d{1,2})\\s+(?:(oh)\\s+(${units})|(${tens})(?:[\\s-](${units}))?|(\\d{2}))(?=\\s*(?:[ap]\\.?\\s*m\\b|o'?\\s*clock))`, 'gi');
  return s.replace(re, (_, h, oh, ohUnit, ten, unit, digits) => {
    const hh = /\d/.test(h) ? Number(h) : ONES[h.toLowerCase()];
    const mm = digits ? Number(digits) : oh ? ONES[ohUnit.toLowerCase()] : TENS[ten.toLowerCase()] + (unit ? ONES[unit.toLowerCase()] : 0);
    return `${hh}:${String(mm).padStart(2, '0')}`;
  });
}

export function voiceToQuickAdd(transcript: string): string {
  let s = ` ${transcript.trim()} `;
  // wake words and polite filler at the start
  s = s.replace(
    /^\s*(?:(?:hey|hi|ok|okay)[\s,]+(?:homework(?:\s+to-?do)?[\s,]+)?)?(?:please[\s,]+)?(?:(?:can you|could you)\s+)?(?:add(?:\s+a)?(?:\s+(?:new\s+)?task)?(?:\s+to)?[\s,:]+|remind me to\s+|i need to\s+|i have to\s+|i've got to\s+|new task[\s,:]+)?/i,
    ' ',
  );
  s = s.replace(/\bplease\b/gi, ' ');
  // spoken markup
  s = s.replace(/\bhash\s*tag\s+(\w+)/gi, '#$1');
  s = s.replace(/\b(?:it's\s+)?(urgent|high|low)\s+priority\b|\bpriority\s+(urgent|high|low)\b/gi, (_, a, b) => ` !${(a || b).toLowerCase()} `);
  s = s.replace(/\b(?:it's\s+)?urgent\b(?!\s*priority)/gi, ' !urgent ');
  s = s.replace(new RegExp(`\\b(${Object.keys(ORDINALS).join('|')})\\b`, 'gi'), (w) => ORDINALS[w.toLowerCase()]);
  s = spokenTimes(s);
  s = numbersToDigits(s);
  s = s.replace(/(\d)\s*([ap])\.?\s*m\.?(?=[\s,.!?]|$)/gi, (_, d, ap) => `${d}${ap.toLowerCase()}m`);
  s = s.replace(/\b(\d{1,2})\s+o'?\s*clock\b/gi, '$1:00');
  // durations: "takes 30 minutes", "for an hour", "about 45 min"
  s = s.replace(/\b(?:it\s+)?(?:takes?|for|about|around)\s+(?:an?|1)\s+hour\b/gi, ' ~60m ');
  s = s.replace(
    /\b(?:it\s+)?(?:takes?|for|about|around)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/gi,
    (_, n, u) => ` ~${/^h/i.test(u) ? Math.round(Number(n) * 60) : n}m `,
  );
  // "for tomorrow" / "by friday" read as the due date
  s = s.replace(/\b(?:for|by)\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/gi, '$1');
  s = s.replace(/\bdue\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/gi, '$1');
  return s
    .replace(/[,;]+(?=\s)|[.!?]+\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
