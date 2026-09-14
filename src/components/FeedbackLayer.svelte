<script lang="ts">
  // Listens to app events and produces the dopamine layer: XP toasts, level-up, badges, ring confetti, sound prompt.
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { on } from '../lib/events';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { undo } from '../lib/undo.svelte';
  import { playSound, primeAudio } from '../lib/sounds';
  import { badgeById } from '../lib/gamification';
  import Confetti from './Confetti.svelte';

  let confetti = $state(0);
  let levelUp = $state<number | null>(null);
  let badge = $state<{ id: string; name: string; emoji: string; description: string } | null>(null);
  let queue: (() => void)[] = [];
  let busy = false;

  function enqueue(fn: () => void) {
    queue.push(fn);
    pump();
  }
  function pump() {
    if (busy) return;
    const fn = queue.shift();
    if (!fn) return;
    busy = true;
    fn();
  }
  function done(delay: number) {
    setTimeout(() => {
      busy = false;
      pump();
    }, delay);
  }

  onMount(() => {
    const offs = [
      on('completed', (e) => {
        const g = store.settings.gamification;
        const entry = undo.stack[undo.stack.length - 1];
        const parts: string[] = [];
        if (e.xp.early) parts.push('early +25%');
        if (e.xp.longTask) parts.push('long task ×1.5');
        if (e.xp.frog) parts.push('🐸 frog ×2');
        if (e.xp.early && e.xp.earlyDays >= 3) parts[parts.indexOf('early +25%')] = `${e.xp.earlyDays} days early ×1.5`;
        if (e.xp.crit) parts.unshift('💥 CRITICAL HIT ×2');
        if (e.xp.powerHour) parts.unshift('⚡ POWER HOUR ×1.5');
        if (e.xp.comboCount > 0) parts.push(`combo ×${e.xp.comboMultiplier.toFixed(1)}`);
        if (e.xp.subtaskBonus) parts.push(`+${e.xp.subtaskBonus} subtasks`);
        toasts.push({
          message: g ? `+${e.xp.total} XP · ${e.task.title}` : `Completed “${e.task.title}”`,
          detail: g && parts.length ? parts.join(' · ') : undefined,
          kind: g ? 'xp' : 'success',
          combo: g ? e.xp.comboCount : 0,
          emoji: g ? (e.xp.crit ? '💥' : e.xp.comboCount >= 5 ? '🔥' : e.xp.comboCount >= 2 ? '⚡' : '✨') : '✓',
          timeout: 5000,
          action: entry
            ? {
                label: 'Undo',
                onClick: () => {
                  toasts.items.filter((t) => t.action?.label === 'Undo' && t.message.includes(e.task.title)).forEach((t) => toasts.dismiss(t.id));
                  void undo.undoEntry(entry);
                },
              }
            : undefined,
        });
        if (g && e.freezeEarned) {
          toasts.push({ message: 'Streak freeze earned', detail: 'A missed day will not break your streak.', kind: 'info', emoji: '🧊' });
        }
      }),
      on('graded', (e) => {
        if (!store.settings.gamification) return;
        const aced = e.tier === 'aced';
        toasts.push({
          message: `+${e.xp} XP · ${e.label}`,
          detail: `${e.task.score}% on “${e.task.title}”${e.task.weight ? ` · worth ${e.task.weight}%` : ''}`,
          kind: 'xp',
          combo: aced ? 6 : e.tier === 'great' ? 3 : 0,
          emoji: aced ? '🅰️' : e.tier === 'great' ? '🌟' : e.tier === 'good' ? '👍' : '📝',
          timeout: 6000,
        });
        if (aced) {
          enqueue(() => {
            confetti++;
            playSound('ring');
            done(1000);
          });
        }
      }),
      on('studied', (e) => {
        if (!store.settings.gamification) return;
        toasts.push({ message: `+${e.xp} XP · ${e.clearedAll ? 'Deck cleared!' : 'Study session'}`, detail: `${e.correct}/${e.reviewed} cards right`, kind: 'xp', combo: e.clearedAll ? 4 : 0, emoji: e.clearedAll ? '🃏' : '📚' });
        if (e.clearedAll) playSound('badge');
      }),
      on('collectible', (c) => {
        enqueue(() => {
          toasts.push({ message: `Mystery reward: ${c.emoji} ${c.name}`, detail: c.kind === 'title' ? 'A new title for your profile. See Settings → Collection.' : 'A new sticker for your collection.', kind: 'badge', emoji: '🎁', timeout: 7000 });
          playSound('badge');
          done(600);
        });
      }),
      on('streakMilestone', ({ days }) => {
        enqueue(() => {
          confetti++;
          playSound('levelup');
          toasts.push({ message: `${days}-day streak!`, detail: days >= 30 ? 'That is real discipline.' : 'Keep the chain going.', kind: 'levelup', emoji: '🔥', timeout: 6000 });
          done(1500);
        });
      }),
      on('synced', (e) => {
        if (e.created > 0) playSound('tick');
      }),
      on('levelup', ({ level }) => {
        if (!store.settings.gamification) return;
        enqueue(() => {
          levelUp = level;
          playSound('levelup');
          setTimeout(() => (levelUp = null), 2200);
          done(2400);
        });
      }),
      on('badge', ({ id }) => {
        if (!store.settings.gamification) return;
        const def = badgeById(id);
        if (!def) return;
        enqueue(() => {
          badge = def;
          playSound('badge');
          setTimeout(() => (badge = null), 2600);
          done(2800);
        });
      }),
      on('ringClosed', ({ day }) => {
        if (!store.settings.gamification) return;
        if (store.stats.ringCelebratedDate === day) return;
        store.markRingCelebrated(day);
        enqueue(() => {
          confetti++;
          playSound('ring');
          toasts.push({ message: 'Daily goal reached!', detail: `${store.settings.dailyGoal} tasks done today. Anything else is a bonus.`, kind: 'success', emoji: '🎯', timeout: 5000 });
          done(1200);
        });
      }),
    ];
    // One-time sound prompt (sounds are muted by default).
    if (!store.settings.soundPromptShown) {
      setTimeout(() => {
        if (store.settings.soundPromptShown) return;
        toasts.push({
          message: 'Turn on sounds?',
          detail: 'A crisp pop when you finish a task. You can change this in Settings.',
          kind: 'info',
          emoji: '🔊',
          timeout: 12000,
          action: {
            label: 'Enable',
            onClick: () => {
              store.updateSettings({ soundsEnabled: true, soundPromptShown: true });
              primeAudio();
              playSound('pop');
              toasts.items.filter((t) => t.message === 'Turn on sounds?').forEach((t) => toasts.dismiss(t.id));
            },
          },
        });
        store.updateSettings({ soundPromptShown: true });
      }, 2500);
    }
    return () => offs.forEach((f) => f());
  });
</script>

<Confetti trigger={confetti} />

{#if levelUp !== null}
  <div class="overlay" transition:fade={{ duration: 200 }} aria-live="assertive">
    <div class="levelup" in:scale={{ start: 0.6, duration: 500, opacity: 0 }}>
      <div class="glow"></div>
      <div class="lbl">Level up</div>
      <div class="num">{levelUp}</div>
      <div class="sub">Keep going.</div>
    </div>
  </div>
{/if}

{#if badge}
  <div class="badge-pop" transition:scale={{ start: 0.5, duration: 400 }} role="status">
    <div class="medal"><span>{badge.emoji}</span></div>
    <div>
      <div class="lbl">Badge unlocked</div>
      <div class="name">{badge.name}</div>
      <div class="desc">{badge.description}</div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.35);
    z-index: 400;
    pointer-events: none;
  }
  .levelup {
    position: relative;
    text-align: center;
    color: #fff;
    padding: 40px 60px;
    border-radius: 24px;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #ff7675));
    box-shadow: 0 20px 80px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .glow {
    position: absolute;
    inset: -30px;
    border-radius: 40px;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 50%, transparent), transparent 70%);
    animation: pulse 1.2s ease-in-out infinite;
    z-index: -1;
  }
  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
  }
  .levelup .lbl {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 13px;
    font-weight: 700;
    opacity: 0.9;
  }
  .num {
    font-size: 84px;
    font-weight: 800;
    line-height: 1;
    margin: 6px 0;
    animation: bounce 600ms var(--spring);
  }
  @keyframes bounce {
    from {
      transform: scale(0.4);
    }
    to {
      transform: scale(1);
    }
  }
  .sub {
    opacity: 0.9;
  }
  .badge-pop {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--bg-elev);
    border: 1px solid var(--warn);
    border-radius: 16px;
    padding: 12px 18px 12px 12px;
    box-shadow: var(--shadow), 0 0 40px color-mix(in srgb, var(--warn) 35%, transparent);
    z-index: 401;
    max-width: calc(100vw - 32px);
  }
  .medal {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 28px;
    background: radial-gradient(circle at 30% 30%, #fff3b0, #f6b93b 60%, #d4880f);
    box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.25);
    animation: spin-in 700ms var(--spring);
  }
  @keyframes spin-in {
    from {
      transform: rotateY(180deg) scale(0.4);
    }
    to {
      transform: rotateY(0) scale(1);
    }
  }
  .badge-pop .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--warn);
    font-weight: 700;
  }
  .name {
    font-weight: 700;
    font-size: 16px;
  }
  .desc {
    font-size: 13px;
    color: var(--text-muted);
  }
  @media (max-width: 720px) {
    .levelup {
      padding: 30px 40px;
    }
    .num {
      font-size: 64px;
    }
  }
</style>
