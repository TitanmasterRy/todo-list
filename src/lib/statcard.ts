// Shareable weekly stats card: a PNG with this week's numbers (never task titles), drawn on a canvas.
import { addDaysKey, dueKey, fromKey, DAY_SHORT, MONTH_SHORT } from './dates';
import type { Course, Stats, Task } from './types';

export interface WeekSummary {
  from: string;
  to: string;
  done: number;
  xp: number;
  streak: number;
  ringDays: number;
  days: { key: string; count: number }[];
  topCourses: { name: string; emoji?: string; count: number }[];
  level: number;
}

/** The 7 days ending today. */
export function weekSummary(stats: Stats, tasks: Task[], courses: Course[], today: string, streak: number, dailyGoal: number): WeekSummary {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i - 6)).map((key) => ({ key, count: stats.completionsByDay[key] ?? 0 }));
  const from = days[0].key;
  const done = days.reduce((a, d) => a + d.count, 0);
  const xp = days.reduce((a, d) => a + (stats.xpByDay?.[d.key] ?? 0), 0);
  const per = new Map<string, number>();
  for (const t of tasks) {
    if (!t.completedAt || !t.courseId) continue;
    const k = dueKey(t.completedAt);
    if (k >= from && k <= today) per.set(t.courseId, (per.get(t.courseId) ?? 0) + 1);
  }
  const topCourses = [...per.entries()]
    .map(([id, count]) => ({ c: courses.find((x) => x.id === id), count }))
    .filter((x): x is { c: Course; count: number } => !!x.c)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ c, count }) => ({ name: c.name, emoji: c.emoji, count }));
  return { from, to: today, done, xp, streak, ringDays: days.filter((d) => d.count >= (dailyGoal || 3)).length, days, topCourses, level: stats.level };
}

const md = (k: string) => `${MONTH_SHORT[fromKey(k).getMonth()]} ${fromKey(k).getDate()}`;

/** Draw the card (1080×1080, square for stories and chats). */
export function drawStatCard(ctx: CanvasRenderingContext2D, s: WeekSummary, opts: { accent: string; name?: string; showCourses: boolean }): void {
  const W = 1080;
  const H = 1080;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#15131f');
  g.addColorStop(1, '#241c3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = opts.accent;
  ctx.fillRect(0, 0, W, 14);
  const font = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.font = font(800, 64);
  ctx.fillText(opts.name ? `${opts.name}'s week` : 'My homework week', 80, 150);
  ctx.fillStyle = '#b9b4d0';
  ctx.font = font(500, 34);
  ctx.fillText(`${md(s.from)} – ${md(s.to)}`, 80, 205);

  const tiles: [string, string][] = [
    [String(s.done), s.done === 1 ? 'task done' : 'tasks done'],
    [`🔥 ${s.streak}`, 'day streak'],
    [`${s.ringDays}/7`, 'goal days'],
    [s.xp.toLocaleString(), 'XP earned'],
  ];
  tiles.forEach(([v, l], i) => {
    const x = 80 + (i % 2) * 470;
    const y = 270 + Math.floor(i / 2) * 200;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, x, y, 440, 170, 28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = font(800, 76);
    ctx.fillText(v, x + 36, y + 96);
    ctx.fillStyle = '#b9b4d0';
    ctx.font = font(500, 30);
    ctx.fillText(l, x + 38, y + 144);
  });

  // one column per day; today in the accent, the others a lighter step of it
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const baseY = 900;
  s.days.forEach((d, i) => {
    const x = 110 + i * 128;
    const h = d.count ? Math.max(12, (d.count / max) * 190) : 6;
    ctx.fillStyle = i === 6 ? opts.accent : 'rgba(255,255,255,0.28)';
    roundRect(ctx, x, baseY - h, 60, h, [12, 12, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#b9b4d0';
    ctx.font = font(500, 26);
    ctx.textAlign = 'center';
    ctx.fillText(DAY_SHORT[fromKey(d.key).getDay()], x + 30, baseY + 40);
    if (d.count) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(d.count), x + 30, baseY - h - 14);
    }
    ctx.textAlign = 'left';
  });

  if (opts.showCourses && s.topCourses.length) {
    ctx.fillStyle = '#b9b4d0';
    ctx.font = font(500, 28);
    ctx.fillText(`Most done: ${s.topCourses.map((c) => `${c.emoji ? c.emoji + ' ' : ''}${c.name} (${c.count})`).join(' · ')}`.slice(0, 70), 80, 1000);
  }
  ctx.fillStyle = '#8f89ab';
  ctx.font = font(600, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`Level ${s.level} · Homework To-Do`, W - 80, H - 40);
  ctx.textAlign = 'left';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
