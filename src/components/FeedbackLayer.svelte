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
  import { buzz } from '../lib/haptics';
  import Confetti from './Confetti.svelte';
  import { t as tr } from '../lib/i18n/index.svelte';

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
        buzz('done');
        const g = store.settings.gamification;
        const entry = undo.stack[undo.stack.length - 1];
        const parts: string[] = [];
        if (e.xp.early) parts.push(e.xp.earlyDays >= 3 ? tr('xp.earlyDays', { n: e.xp.earlyDays }) : tr('xp.early'));
        if (e.xp.longTask) parts.push(tr('xp.long'));
        if (e.xp.frog) parts.push(tr('xp.frog'));
        if (e.xp.crit) parts.unshift(tr('xp.crit'));
        if (e.xp.powerHour) parts.unshift(tr('xp.power'));
        if (e.xp.comboCount > 0) parts.push(tr('xp.combo', { n: e.xp.comboMultiplier.toFixed(1) }));
        if (e.xp.subtaskBonus) parts.push(tr('xp.subtasks', { n: e.xp.subtaskBonus }));
        toasts.push({
          message: g ? `+${e.xp.total} XP · ${e.task.title}` : tr('toast.completed', { title: e.task.title }),
          detail: g && parts.length ? parts.join(' · ') : undefined,
          kind: g ? 'xp' : 'success',
          combo: g ? e.xp.comboCount : 0,
          emoji: g ? (e.xp.crit ? '💥' : e.xp.comboCount >= 5 ? '🔥' : e.xp.comboCount >= 2 ? '⚡' : '✨') : '✓',
          timeout: 5000,
          action: entry
            ? {
                label: tr('common.undo'),
                onClick: () => {
                  toasts.items.filter((t) => t.action?.label === tr('common.undo') && t.message.includes(e.task.title)).forEach((t) => toasts.dismiss(t.id));
                  void undo.undoEntry(entry);
                },
              }
            : undefined,
        });
        if (g && e.freezeEarned) {
          toasts.push({ message: tr('xp.freeze'), detail: tr('xp.freezeDetail'), kind: 'info', emoji: '🧊' });
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
        toasts.push({
          message: `+${e.xp} XP · ${e.clearedAll ? tr('grade.deckClearedBang') : tr('grade.studySession')}`,
          detail: `${e.correct}/${e.reviewed} cards right`,
          kind: 'xp',
          combo: e.clearedAll ? 4 : 0,
          emoji: e.clearedAll ? '🃏' : '📚',
        });
        if (e.clearedAll) playSound('badge');
      }),
      on('collectible', (c) => {
        enqueue(() => {
          toasts.push({
            message: tr('fb.mystery', { reward: `${c.emoji} ${c.name}` }),
            detail: c.kind === 'title' ? tr('fb.newTitle') : tr('fb.newSticker'),
            kind: 'badge',
            emoji: '🎁',
            timeout: 7000,
          });
          playSound('badge');
          done(600);
        });
      }),
      on('streakMilestone', ({ days }) => {
        enqueue(() => {
          confetti++;
          playSound('streak');
          buzz('levelup');
          toasts.push({ message: tr('xp.streak', { n: days }), detail: days >= 30 ? tr('xp.streak30') : tr('xp.streakKeep'), kind: 'levelup', emoji: '🔥', timeout: 6000 });
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
          confetti++;
          playSound('levelup');
          buzz('levelup');
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
          buzz('tap');
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
          buzz('ring');
          toasts.push({
            message: tr('xp.goal'),
            detail: tr('xp.goalDetail', { count: store.settings.dailyGoal }),
            kind: 'success',
            emoji: '🎯',
            timeout: 5000,
          });
          done(1200);
        });
      }),
    ];
    // One-time sound prompt (sounds are muted by default).
    if (!store.settings.soundPromptShown) {
      setTimeout(() => {
        if (store.settings.soundPromptShown) return;
        toasts.push({
          message: tr('xp.soundPrompt'),
          detail: tr('xp.soundPromptDetail'),
          kind: 'info',
          emoji: '🔊',
          timeout: 12000,
          action: {
            label: tr('xp.enable'),
            onClick: () => {
              store.updateSettings({ soundsEnabled: true, soundPromptShown: true });
              primeAudio();
              playSound('pop');
              toasts.items.filter((t) => t.message === tr('xp.soundPrompt')).forEach((t) => toasts.dismiss(t.id));
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
      <div class="rays" aria-hidden="true"></div>
      <div class="glow"></div>
      <div class="lbl">{tr('xp.levelUp')}</div>
      <div class="num">{levelUp}</div>
      <div class="sub">{tr('xp.keepGoing')}</div>
    </div>
  </div>
{/if}

{#if badge}
  <div class="badge-pop" transition:scale={{ start: 0.5, duration: 400 }} role="status">
    <div class="medal"><span>{badge.emoji}</span><i class="shine" aria-hidden="true"></i></div>
    <div>
      <div class="lbl">{tr('xp.badge')}</div>
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
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), rgba(0, 0, 0, 0.55) 70%);
    z-index: 400;
    pointer-events: none;
    overflow: hidden;
  }
  .levelup {
    position: relative;
    text-align: center;
    color: #fff;
    padding: 44px 72px;
    border-radius: 28px;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent-2) 80%, var(--accent)) 60%, color-mix(in srgb, var(--accent) 50%, #ff7675));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 30px 90px color-mix(in srgb, var(--accent) 70%, transparent),
      0 0 0 6px rgba(255, 255, 255, 0.12);
  }
  /* rotating light rays behind the card */
  .rays {
    position: absolute;
    inset: -260px;
    background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.16) 0deg 9deg, transparent 9deg 22deg);
    border-radius: 50%;
    animation: spin 14s linear infinite;
    z-index: -2;
    -webkit-mask: radial-gradient(circle, #000 20%, transparent 65%);
    mask: radial-gradient(circle, #000 20%, transparent 65%);
  }
  .glow {
    position: absolute;
    inset: -30px;
    border-radius: 40px;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 60%, transparent), transparent 70%);
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
      transform: scale(1.12);
      opacity: 1;
    }
  }
  .levelup .lbl {
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 13px;
    font-weight: 800;
    opacity: 0.95;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }
  .num {
    font-size: 96px;
    font-weight: 900;
    line-height: 1;
    margin: 6px 0;
    animation: bounce 700ms var(--spring);
    text-shadow:
      0 4px 0 rgba(0, 0, 0, 0.15),
      0 10px 30px rgba(0, 0, 0, 0.35);
    background: linear-gradient(180deg, #fff, rgba(255, 255, 255, 0.75));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  @keyframes bounce {
    from {
      transform: scale(0.4) rotate(-6deg);
    }
    to {
      transform: scale(1) rotate(0);
    }
  }
  .sub {
    opacity: 0.95;
    font-weight: 600;
  }
  .badge-pop {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--glass);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
    border: 1px solid color-mix(in srgb, var(--gold) 70%, var(--border));
    border-radius: 18px;
    padding: 12px 20px 12px 12px;
    box-shadow:
      var(--shadow-lg),
      0 0 50px color-mix(in srgb, var(--gold) 40%, transparent);
    z-index: 401;
    max-width: calc(100vw - 32px);
  }
  .medal {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 30px;
    background: radial-gradient(circle at 30% 30%, #fff3b0, #f6b93b 60%, #d4880f);
    box-shadow:
      inset 0 -3px 6px rgba(0, 0, 0, 0.25),
      0 0 0 3px rgba(255, 255, 255, 0.25),
      0 8px 20px -6px rgba(212, 136, 15, 0.8);
    animation: spin-in 700ms var(--spring);
    overflow: hidden;
  }
  .medal .shine {
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.7) 50%, transparent 65%);
    background-size: 200% 100%;
    animation: shimmer 1.8s linear infinite;
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
    letter-spacing: 0.12em;
    color: var(--warn-text);
    font-weight: 800;
  }
  .name {
    font-weight: 800;
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
      font-size: 68px;
    }
  }
</style>
