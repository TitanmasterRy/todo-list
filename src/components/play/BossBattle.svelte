<script lang="ts">
  // Notecard boss battle: each card is a turn with four choices. Right answers hit the boss, wrong ones cost hearts.
  import { onDestroy, untrack } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { answerBattle, answerText, battleScore, BOSS_PHASES, bossPhase, hitFor, newBattle, pickChoices, PLAYER_HP, type Battle, type Choice } from '../../lib/studygames';
  import type { Card, Deck } from '../../lib/types';
  import { renderTextWithMath } from '../../lib/math.svelte';

  interface Props {
    deck: Deck;
    cards: Card[];
    onexit: () => void;
  }
  let { deck, cards, onexit }: Props = $props();

  const byId = $derived(new Map(cards.map((c) => [c.id, c])));
  let battle = $state<Battle>(untrack(() => newBattle(cards)));
  let shownId = $state<string | null>(null); // the card on screen (stays up while the answer is revealed)
  let choices = $state<Choice[]>([]);
  let picked = $state<string | null>(null);
  let feedback = $state('');
  let bossHits = $state(0); // bumped to replay the hit animations
  let youHits = $state(0);
  let lastDmg = $state(0);
  let startedAt = $state(Date.now());
  let endedAt = $state(0);
  let newBest = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const current = $derived(shownId ? byId.get(shownId) : undefined);
  const phase = $derived(BOSS_PHASES[bossPhase(battle)]);
  const score = $derived(battleScore(battle));
  const accuracy = $derived(battle.right + battle.wrong ? Math.round((battle.right / (battle.right + battle.wrong)) * 100) : 0);
  const secs = $derived(Math.round(((endedAt || Date.now()) - startedAt) / 1000));

  function deal() {
    shownId = battle.queue[0] ?? null;
    const c = shownId ? byId.get(shownId) : undefined;
    choices = c ? pickChoices(c, cards) : [];
    picked = null;
  }
  untrack(deal);

  function choose(ch: Choice) {
    if (picked || battle.result !== 'playing' || !current) return;
    picked = ch.id;
    const before = battle;
    battle = answerBattle(battle, ch.correct);
    if (ch.correct) {
      lastDmg = hitFor(battle.streak);
      bossHits++;
      feedback = `Hit! −${lastDmg} boss HP${battle.streak >= 3 ? ' (critical)' : ''}`;
      playSound('pop');
    } else {
      lastDmg = before.hp - battle.hp;
      youHits++;
      feedback = `Ouch! It was “${answerText(current)}”. −${lastDmg} ❤️`;
      playSound('undo');
    }
    timer = setTimeout(next, ch.correct ? 650 : 1600);
  }
  function next() {
    if (battle.result === 'playing') deal();
    else finish();
  }
  function finish() {
    endedAt = Date.now();
    picked = null;
    feedback = '';
    newBest = arcade.recordScore(`boss:${deck.id}`, score);
    if (newBest) toasts.push({ message: `New best boss battle on ${deck.name}`, detail: score.toLocaleString(), kind: 'success', emoji: '🏆' });
  }
  function rematch() {
    clearTimeout(timer);
    battle = newBattle(cards);
    startedAt = Date.now();
    endedAt = 0;
    newBest = false;
    feedback = '';
    deal();
  }
  function onKey(e: KeyboardEvent) {
    if (endedAt || picked || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const ch = /^[1-4]$/.test(e.key) ? choices[Number(e.key) - 1] : undefined;
    if (ch) {
      e.preventDefault();
      choose(ch);
    }
  }
  // number keys pick answers here, not views
  $effect(() => {
    ui.captureKeys = !endedAt;
  });
  onDestroy(() => {
    ui.captureKeys = false;
    clearTimeout(timer);
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="bar">
  <button class="btn ghost sm" onclick={onexit}>← Decks</button>
  <h2>🐉 Boss battle · {deck.name}</h2>
</div>

{#if endedAt}
  <section class="card end" aria-live="polite">
    <div class="big" aria-hidden="true">{battle.result === 'won' ? '🏆' : '💀'}</div>
    <h3>{battle.result === 'won' ? `You beat the ${phase.name}!` : `The ${phase.name} wins this time`}</h3>
    <dl class="stats">
      <div>
        <dt>Score</dt>
        <dd class="gold-text">{score.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Right</dt>
        <dd>{battle.right}</dd>
      </div>
      <div>
        <dt>Wrong</dt>
        <dd>{battle.wrong}</dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd>{accuracy}%</dd>
      </div>
      <div>
        <dt>Best streak</dt>
        <dd>{battle.bestStreak}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</dd>
      </div>
    </dl>
    <p class="muted">{newBest ? 'New best for this deck!' : `Best on this deck: ${(arcade.scores[`boss:${deck.id}`] ?? score).toLocaleString()}`}</p>
    {#if battle.missed.length}
      <h4>Cards to review</h4>
      <ul class="missed">
        {#each battle.missed as id (id)}
          {@const c = byId.get(id)}
          {#if c}<li><strong>{c.front || '(picture)'}</strong> → {answerText(c) || '(picture)'}</li>{/if}
        {/each}
      </ul>
    {/if}
    <div class="btns">
      <button class="btn primary" onclick={rematch}>Rematch</button>
      <button class="btn" onclick={onexit}>Pick another deck</button>
    </div>
  </section>
{:else}
  <section class="card arena">
    <div class="fighters">
      <div class="side">
        <div class="avatar">
          {#key bossHits}<span class="emoji" class:hit={bossHits > 0} aria-hidden="true">{phase.emoji}</span>{/key}
          {#key bossHits}{#if bossHits && picked}<span class="dmg" class:crit={battle.streak >= 3} aria-hidden="true">−{lastDmg}</span>{/if}{/key}
        </div>
        <div class="who">{phase.name}</div>
        <div class="hp" role="progressbar" aria-label="Boss HP" aria-valuemin={0} aria-valuemax={battle.bossMax} aria-valuenow={battle.bossHp}>
          <span class="fill" style="width:{(battle.bossHp / battle.bossMax) * 100}%"></span>
          {#key bossHits}{#if bossHits}<span class="flash" aria-hidden="true"></span>{/if}{/key}
        </div>
        <div class="muted small">{battle.bossHp}/{battle.bossMax} HP · “{phase.taunt}”</div>
      </div>
      <div class="side you">
        {#key youHits}<div class="hearts" class:hurt={youHits > 0} role="img" aria-label="Your health: {battle.hp} of {PLAYER_HP}">
            {'❤️'.repeat(battle.hp)}{'🤍'.repeat(PLAYER_HP - battle.hp)}
          </div>{/key}
        <div class="php" aria-hidden="true"><span class="fill" style="width:{(battle.hp / PLAYER_HP) * 100}%"></span></div>
        <div class="muted small">
          Streak {#key battle.streak}<span class="streak bump" class:fire={battle.streak >= 2}>{battle.streak}</span>{/key}{battle.streak >= 2 ? ' 🔥' : ''} · {battle.queue.length} card{battle
            .queue.length === 1
            ? ''
            : 's'} left
        </div>
        <div class="muted small">3 in a row = critical hits</div>
      </div>
    </div>

    {#if current}
      <div class="q">
        {#if current.frontImage}<img src={current.frontImage} alt="" />{/if}
        <div class="qt" data-question>{@html renderTextWithMath(current.front)}</div>
      </div>
      <div class="choices">
        {#each choices as ch, i (ch.id)}
          <button class="choice" class:ok={!!picked && ch.correct} class:bad={picked === ch.id && !ch.correct} aria-disabled={!!picked} onclick={() => choose(ch)}>
            <span class="kbd">{i + 1}</span>
            {#if ch.image}<img src={ch.image} alt="" />{/if}
            <span class="ct">{ch.text || '(picture)'}</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="feedback" aria-live="polite">{feedback}</div>
  </section>
{/if}

<style>
  .bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .bar h2 {
    font-size: 18px;
    margin: 0;
    font-weight: 800;
  }
  /* the arena: a dark stage with a red spotlight behind the boss and a cool one behind you */
  .arena {
    position: relative;
    display: grid;
    gap: 14px;
    overflow: hidden;
    background:
      radial-gradient(40% 55% at 12% 10%, color-mix(in srgb, var(--danger) 16%, transparent), transparent 70%),
      radial-gradient(35% 45% at 95% 20%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), var(--bg-elev);
    animation: pop-in var(--dur-slow) var(--spring) backwards;
  }
  .fighters {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: end;
  }
  .side {
    display: grid;
    gap: 4px;
  }
  .you {
    justify-items: end;
    text-align: right;
  }
  .avatar {
    position: relative;
    width: max-content;
    padding: 6px 8px 0;
  }
  .avatar::before {
    content: '';
    position: absolute;
    inset: -10px -20px;
    z-index: 0;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--danger) 28%, transparent), transparent 65%);
    animation: glow-breathe 2.6s ease-in-out infinite;
    pointer-events: none;
  }
  .emoji {
    position: relative;
    z-index: 1;
    display: inline-block;
    font-size: 64px;
    line-height: 1;
    filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35));
    animation: float 3.2s ease-in-out infinite;
  }
  .emoji.hit {
    animation: shake 0.45s var(--ease);
  }
  .dmg {
    position: absolute;
    top: 0;
    left: 100%;
    z-index: 2;
    font-weight: 900;
    font-size: 22px;
    color: var(--danger-text);
    text-shadow: 0 2px 8px color-mix(in srgb, var(--danger) 50%, transparent);
    font-variant-numeric: tabular-nums;
    animation: rise 0.75s var(--ease) forwards;
  }
  .dmg.crit {
    font-size: 28px;
    color: var(--warn-text);
    text-shadow: 0 2px 12px color-mix(in srgb, var(--warn) 70%, transparent);
  }
  .who {
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  /* boss HP: a red gradient bar that flashes white when hit */
  .hp {
    position: relative;
    height: 14px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    overflow: hidden;
    max-width: 360px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .hp .fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #b91c1c, var(--danger) 60%, #fb923c);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 0 12px -2px color-mix(in srgb, var(--danger) 70%, transparent);
    transition: width 0.35s var(--ease);
  }
  .hp .flash {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.75);
    animation: flash 420ms var(--ease) forwards;
    pointer-events: none;
  }
  .hearts {
    font-size: 20px;
    letter-spacing: 1px;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
  }
  .hearts.hurt {
    animation: shake 0.45s var(--ease);
  }
  /* your HP: a green gradient bar with a shimmer stripe */
  .php {
    position: relative;
    width: min(100%, 180px);
    height: 8px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .php .fill {
    position: relative;
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #15803d, var(--success) 60%, #86efac);
    box-shadow: 0 0 10px -2px color-mix(in srgb, var(--success) 70%, transparent);
    transition: width 0.35s var(--ease);
  }
  .php .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.35) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2.4s linear infinite;
  }
  .streak {
    font-weight: 800;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .streak.fire {
    color: var(--warn-text);
  }
  .small {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .q {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 16px;
    border-radius: var(--radius);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg-elev-2)), var(--bg-elev-2));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
    box-shadow: inset 0 1px 0 var(--sheen);
    text-align: center;
    animation: rise-in var(--dur-slow) var(--ease) backwards;
  }
  .q img,
  .choice img {
    max-width: 100%;
    max-height: 160px;
    border-radius: 8px;
  }
  .qt {
    font-size: 20px;
    font-weight: 700;
    white-space: pre-wrap;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }
  /* answers: cards that lift on hover, pop green when right and shake red when wrong */
  .choice {
    display: flex;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-elev);
    box-shadow: inset 0 1px 0 var(--sheen);
    font-size: 15px;
    transition:
      border-color var(--dur),
      background var(--dur),
      transform var(--dur) var(--spring),
      box-shadow var(--dur);
  }
  .choice:hover {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      var(--glow);
  }
  .choice .kbd {
    flex-shrink: 0;
  }
  .choice.ok {
    border-color: var(--success);
    background: color-mix(in srgb, var(--success) 18%, var(--bg-elev));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent);
    animation: bump 420ms var(--spring);
  }
  .choice.bad {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 18%, var(--bg-elev));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 25%, transparent);
    animation: shake 0.45s var(--ease);
  }
  .ct {
    white-space: pre-wrap;
  }
  .feedback {
    min-height: 1.4em;
    font-weight: 700;
    text-align: center;
  }
  .end {
    position: relative;
    overflow: hidden;
    text-align: center;
    display: grid;
    gap: 8px;
    justify-items: center;
    background: radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 70%), var(--bg-elev);
    animation: pop-in var(--dur-slow) var(--spring) backwards;
  }
  .big {
    font-size: 56px;
    line-height: 1;
    filter: drop-shadow(0 10px 18px color-mix(in srgb, var(--gold) 45%, transparent));
    animation: float 3.2s ease-in-out infinite;
  }
  .end h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(90px, 1fr));
    gap: 8px;
    margin: 6px 0;
  }
  .stats div {
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  .stats dt {
    font-size: 12px;
    color: var(--text-muted);
  }
  .stats dd {
    margin: 0;
    font-weight: 800;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .missed {
    text-align: left;
    margin: 0;
    font-size: 14px;
  }
  .end h4 {
    margin: 6px 0 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .muted {
    color: var(--text-muted);
  }
  @keyframes shake {
    20% {
      transform: translateX(-6px) rotate(-4deg);
      filter: brightness(1.6) saturate(0.4);
    }
    40% {
      transform: translateX(6px) rotate(4deg);
    }
    60% {
      transform: translateX(-4px);
    }
    80% {
      transform: translateX(3px);
    }
  }
  @keyframes rise {
    to {
      transform: translateY(-28px) scale(1.15);
      opacity: 0;
    }
  }
  @keyframes flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes glow-breathe {
    0%,
    100% {
      opacity: 0.7;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.12);
    }
  }
</style>
