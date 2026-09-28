<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { crapsRoll, fieldPayout, rollDice, type CrapsState } from '../../lib/casino/craps';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let line = $state<'pass' | 'dont'>('pass');
  let lineBet = $state(25);
  let fieldBet = $state(0);
  let s = $state<CrapsState>({ point: null, passBet: 0, dontPassBet: 0, message: 'Place a line bet and roll the come-out.' });
  let rolling = $state(false);
  let lastNet = $state<number | null>(null);
  const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  // pip positions (0–8 on a 3×3 grid) for each die face; presentation only
  const PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

  async function roll() {
    if (rolling) return;
    const onTable = s.passBet + s.dontPassBet > 0;
    const newLine = onTable ? 0 : lineBet;
    const stake = newLine + fieldBet;
    if (stake <= 0 && !onTable) return;
    if (stake > 0 && !economy.bet('craps', stake)) return;
    rolling = true;
    let state = s;
    if (!onTable && newLine) state = { ...state, passBet: line === 'pass' ? newLine : 0, dontPassBet: line === 'dont' ? newLine : 0 };
    await new Promise((r) => setTimeout(r, 400));
    const dice = rollDice();
    const res = crapsRoll(state, dice);
    const field = fieldBet ? fieldPayout(dice[0] + dice[1], fieldBet) : 0;
    const back = res.returned + field;
    economy.payout('craps', back);
    lastNet = back - stake;
    if (back > stake) playSound('pop');
    s = res.state;
    rolling = false;
  }
  const lineOn = $derived(s.passBet + s.dontPassBet > 0);
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-row top">
      <div class="dice" class:roll={rolling} aria-live="polite">
        <span class="sr">{s.last ? `${FACES[s.last[0] - 1]} ${FACES[s.last[1] - 1]}` : '🎲 🎲'}</span>
        {#key s.last}
          {#each [0, 1] as d (d)}
            <span class="die" class:blank={!s.last} aria-hidden="true">
              {#if s.last}{#each PIPS[s.last[d] - 1] as p (p)}<i class="pip" style="grid-area: {Math.floor(p / 3) + 1} / {(p % 3) + 1}"></i>{/each}{/if}
            </span>
          {/each}
        {/key}
      </div>
      <div class="pointbox">
        <div class="cz-label">Point</div>
        {#key s.point}<div class="point puck" class:on={s.point !== null}>{s.point ?? 'Off'}<small aria-hidden="true">{s.point !== null ? 'on' : ''}</small></div>{/key}
      </div>
    </div>
    <div class="msg">{s.message}</div>
    <div class="cz-result" class:win={lastNet !== null && lastNet > 0} class:lose={lastNet !== null && lastNet < 0}>
      {lastNet === null ? '' : lastNet > 0 ? `+${lastNet}` : lastNet < 0 ? `${lastNet}` : 'Even'}
    </div>
    <div class="spots" aria-hidden="true">
      <span class="spot" class:filled={lineOn}
        >{lineOn ? (s.passBet ? 'Pass' : "Don't") : line === 'pass' ? 'Pass' : "Don't"}<small>{lineOn ? s.passBet || s.dontPassBet : lineBet || '—'}</small></span
      >
      <span class="spot" class:filled={fieldBet > 0}>Field<small>{fieldBet || '—'}</small></span>
    </div>
    {#if lineOn}<div class="cz-label">On the line: {s.passBet ? `Pass ${s.passBet}` : `Don't pass ${s.dontPassBet}`}</div>{/if}
  </div>
  <div class="cz-actions">
    {#if !lineOn}
      <div class="cz-seg">
        <button class:on={line === 'pass'} onclick={() => (line = 'pass')}>Pass line</button>
        <button class:on={line === 'dont'} onclick={() => (line = 'dont')}>Don't pass</button>
      </div>
      <BetControl bind:value={lineBet} min={0} label="Line" />
    {/if}
  </div>
  <div class="cz-actions">
    <BetControl bind:value={fieldBet} min={0} label="Field (one roll)" />
    <button class="btn primary" onclick={roll} disabled={rolling || (!lineOn && lineBet + fieldBet <= 0) || (!lineOn ? lineBet : 0) + fieldBet > economy.wallet.chips}
      >{lineOn ? 'Roll for the point' : 'Come-out roll'}</button
    >
  </div>
  <p class="cz-edge">
    Pass wins on 7/11 and loses on 2/3/12 on the come-out; otherwise that number is the point, and you need it again before a 7. Don't pass is the opposite (12 pushes). Field pays
    1:1 on 3, 4, 9, 10, 11, 2:1 on 2 and 3:1 on 12. House edge: pass 1.41%, don't pass 1.36%, field 2.8%.
  </p>
</div>

<style>
  .top {
    gap: 22px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .dice {
    position: relative;
    display: flex;
    gap: 14px;
    padding: 6px;
  }
  /* white cubes with a bevelled edge, a soft shadow and real pips */
  .die {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    padding: 8px;
    background: linear-gradient(145deg, #ffffff 0%, #eceff2 60%, #d5dae0 100%);
    box-shadow:
      inset 0 1px 0 #fff,
      inset 0 -3px 0 rgba(0, 0, 0, 0.12),
      0 8px 14px -4px rgba(0, 0, 0, 0.6);
    animation: cr-land 480ms var(--spring) backwards;
  }
  .die.blank {
    opacity: 0.55;
    animation: none;
  }
  .pip {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    align-self: center;
    background: radial-gradient(circle at 35% 30%, #4b4b55, #111 70%);
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6);
  }
  @keyframes cr-land {
    0% {
      transform: rotate(-200deg) scale(0.4) translateY(-30px);
      opacity: 0;
    }
    100% {
      transform: none;
      opacity: 1;
    }
  }
  .roll .die {
    animation: cr-tumble 0.32s linear infinite;
  }
  .roll .die:last-child {
    animation-direction: reverse;
  }
  @keyframes cr-tumble {
    0% {
      transform: rotate(0) translateY(0);
    }
    50% {
      transform: rotate(180deg) translateY(-8px);
    }
    100% {
      transform: rotate(360deg) translateY(0);
    }
  }
  .pointbox {
    display: grid;
    gap: 4px;
    justify-items: center;
  }
  /* the point puck: black OFF, white ON with the number */
  .puck {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: grid;
    place-content: center;
    line-height: 1;
    font-size: 22px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: #fff;
    background: radial-gradient(circle at 35% 30%, #5a5a5a, #1e1e1e 60%, #050505);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -4px 6px rgba(0, 0, 0, 0.5),
      0 6px 12px -3px rgba(0, 0, 0, 0.6);
    animation: cz-pop 320ms var(--spring) backwards;
  }
  .puck.on {
    color: #1b1b1f;
    background: radial-gradient(circle at 35% 30%, #ffffff, #e7eaee 60%, #b7bec7);
    box-shadow:
      inset 0 1px 0 #fff,
      inset 0 -4px 6px rgba(0, 0, 0, 0.18),
      0 0 18px rgba(255, 224, 102, 0.7),
      0 6px 12px -3px rgba(0, 0, 0, 0.6);
  }
  .puck small {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    min-height: 9px;
    opacity: 0.75;
  }
  .msg {
    font-weight: 500;
  }
  /* bet spots: dashed gold rings that fill once a bet is down */
  .spots {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .spot {
    min-width: 64px;
    height: 64px;
    padding: 0 8px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 224, 102, 0.75);
    display: grid;
    place-content: center;
    text-align: center;
    line-height: 1.1;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
    color: #ffe066;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    transition:
      background var(--dur-slow),
      box-shadow var(--dur-slow),
      color var(--dur-slow),
      transform var(--dur) var(--spring);
  }
  .spot small {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0;
  }
  .spot.filled {
    background: var(--grad-gold);
    color: #3a2e00;
    text-shadow: none;
    border-style: solid;
    border-color: #fff3b0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 0 16px rgba(255, 224, 102, 0.6);
    transform: scale(1.06);
  }
</style>
