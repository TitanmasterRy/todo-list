<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { crapsRoll, fieldPayout, rollDice, type CrapsState } from '../../lib/casino/craps';
  import BetControl from './BetControl.svelte';
  import ChipStack from './ChipStack.svelte';
  import Die3D from './Die3D.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, wait } from './fx';
  import { sfx } from './sfx';

  let line = $state<'pass' | 'dont'>('pass');
  let lineBet = $state(25);
  let fieldBet = $state(0);
  let s = $state<CrapsState>({ point: null, passBet: 0, dontPassBet: 0, message: 'Place a line bet and roll the come-out.' });
  let rolling = $state(false);
  let rolls = $state(0);
  let dice = $state<[number, number]>([3, 4]);
  let lastNet = $state<number | null>(null);
  let fieldOn = $state(0);
  let fieldHit = $state<boolean | null>(null);
  let fx = $state<WinFx>();
  let passEl = $state<HTMLElement>();
  let dontEl = $state<HTMLElement>();
  let fieldEl = $state<HTMLElement>();

  async function roll() {
    if (rolling) return;
    const onTable = s.passBet + s.dontPassBet > 0;
    const newLine = onTable ? 0 : lineBet;
    const stake = newLine + fieldBet;
    if (stake <= 0 && !onTable) return;
    if (stake > 0 && !economy.bet('craps', stake)) return;
    rolling = true;
    fieldHit = null;
    let state = s;
    if (!onTable && newLine) {
      state = { ...state, passBet: line === 'pass' ? newLine : 0, dontPassBet: line === 'dont' ? newLine : 0 };
      s = { ...s, passBet: state.passBet, dontPassBet: state.dontPassBet };
      chipsIn(line === 'pass' ? passEl : dontEl, newLine);
    }
    fieldOn = fieldBet;
    if (fieldBet) setTimeout(() => chipsIn(fieldEl, fieldBet), 120);
    const d = rollDice();
    dice = d;
    rolls++;
    setTimeout(() => sfx('dice'), 380);
    await wait(1000);
    const res = crapsRoll(state, d);
    const sum = d[0] + d[1];
    const field = fieldBet ? fieldPayout(sum, fieldBet) : 0;
    if (fieldBet) fieldHit = field > 0;
    const back = res.returned + field;
    economy.payout('craps', back);
    lastNet = back - stake;
    const lineBack = res.returned;
    if (lineBack > 0) chipsOut(state.passBet ? passEl : dontEl, lineBack);
    if (field > 0) chipsOut(fieldEl, field);
    if (res.resolved || fieldBet) fx?.show(back, (res.resolved ? state.passBet + state.dontPassBet : 0) + fieldBet);
    s = res.state;
    rolling = false;
    setTimeout(() => (fieldOn = 0), 900);
  }
  const lineOn = $derived(s.passBet + s.dontPassBet > 0);
  const sum = $derived(s.last ? s.last[0] + s.last[1] : null);
  const FIELD = [2, 3, 4, 9, 10, 11, 12];
</script>

<div class="cz-game">
  <div class="cz-table craps">
    <div class="points" aria-label="Point: {s.point ?? 'off'}" role="img">
      {#each [4, 5, 6, 8, 9, 10] as n (n)}
        <span class="box" class:point={s.point === n}>
          {n === 6 ? 'SIX' : n === 9 ? 'NINE' : n}
          {#if s.point === n}<span class="puck on">ON</span>{/if}
        </span>
      {/each}
      {#if s.point === null}<span class="puck off">OFF</span>{/if}
    </div>

    <div class="throw">
      <div class="dice" aria-live="polite" aria-label={s.last ? `Dice: ${s.last[0]} and ${s.last[1]}` : 'Dice'} role="img">
        <Die3D value={dice[0]} {rolls} size={60} color="red" from={240} />
        <Die3D value={dice[1]} {rolls} size={60} color="red" from={280} delay={60} />
      </div>
      {#if sum !== null && !rolling}<span class="cz-badge sum">{sum}</span>{/if}
    </div>

    <div class="msg">{s.message}</div>

    <div class="field" class:hit={fieldHit === true} class:miss={fieldHit === false} bind:this={fieldEl}>
      <span class="cz-print">Field</span>
      <span class="fnums">
        {#each FIELD as n (n)}<span class:dbl={n === 2 || n === 12} class:lit={!rolling && fieldHit !== null && sum === n}>{n}</span>{/each}
      </span>
      <span class="cz-print small">2 pays double · 12 pays triple</span>
      {#if fieldOn}<span class="stack"><ChipStack amount={fieldOn} size={28} /></span>{/if}
    </div>

    <div class="lines">
      <div class="band dont" class:sel={!lineOn && line === 'dont'} bind:this={dontEl}>
        <span class="cz-print">Don't pass bar</span>
        {#if s.dontPassBet}<span class="stack"><ChipStack amount={s.dontPassBet} size={28} /></span>{/if}
      </div>
      <div class="band pass" class:sel={!lineOn && line === 'pass'} bind:this={passEl}>
        <span class="cz-print big">Pass line</span>
        {#if s.passBet}<span class="stack"><ChipStack amount={s.passBet} size={28} /></span>{/if}
      </div>
    </div>

    <div class="cz-result center" class:win={lastNet !== null && lastNet > 0} class:lose={lastNet !== null && lastNet < 0}>
      {lastNet === null ? '' : lastNet > 0 ? `+${lastNet}` : lastNet < 0 ? `${lastNet}` : 'Even'}
    </div>
    {#if lineOn}<div class="cz-label center">On the line: {s.passBet ? `Pass ${s.passBet}` : `Don't pass ${s.dontPassBet}`}</div>{/if}
    <WinFx bind:this={fx} />
  </div>
  {#if !lineOn}
    <div class="cz-deck">
      <div class="cz-seg" role="group" aria-label="Line bet">
        <button class:on={line === 'pass'} aria-pressed={line === 'pass'} onclick={() => (line = 'pass')}>Pass line</button>
        <button class:on={line === 'dont'} aria-pressed={line === 'dont'} onclick={() => (line = 'dont')}>Don't pass</button>
      </div>
      <BetControl bind:value={lineBet} min={0} label="Line" />
    </div>
  {/if}
  <div class="cz-deck">
    <BetControl bind:value={fieldBet} min={0} label="Field (one roll)" />
    <div class="grow"></div>
    <button
      class="btn cz-go"
      onclick={roll}
      disabled={rolling || (!lineOn && lineBet + fieldBet <= 0) || (!lineOn ? lineBet : 0) + fieldBet > economy.wallet.chips}>{lineOn ? 'Roll for the point' : 'Come-out roll'}</button
    >
  </div>
  <p class="cz-edge">
    Pass wins on 7/11 and loses on 2/3/12 on the come-out; otherwise that number is the point, and you need it again before a 7. Don't pass is the opposite (12 pushes). Field pays
    1:1 on 3, 4, 9, 10, 11, 2:1 on 2 and 3:1 on 12. House edge: pass 1.41%, don't pass 1.36%, field 2.8%.
  </p>
</div>

<style>
  .craps {
    gap: 14px;
  }
  .points {
    position: relative;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border: 2px solid rgba(255, 244, 210, 0.75);
    border-radius: 6px;
  }
  .box {
    position: relative;
    display: grid;
    place-items: center;
    height: 50px;
    font-family: Georgia, serif;
    font-weight: 900;
    font-size: 20px;
    color: #fff8e0;
    border-left: 2px solid rgba(255, 244, 210, 0.75);
  }
  .box:first-child {
    border-left: 0;
  }
  .box.point {
    background: rgba(255, 230, 120, 0.18);
  }
  .puck {
    position: absolute;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    font-family: system-ui, sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.05em;
    box-shadow:
      0 3px 0 rgba(0, 0, 0, 0.4),
      0 5px 10px rgba(0, 0, 0, 0.35);
    animation: puck 400ms cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .puck.on {
    top: -14px;
    right: 4px;
    background: radial-gradient(circle at 40% 35%, #fff, #e6e6e6);
    color: #111;
    border: 3px solid #111;
  }
  .puck.off {
    top: -14px;
    left: -10px;
    background: radial-gradient(circle at 40% 35%, #444, #111);
    color: #fff;
    border: 3px solid #fff;
  }
  @keyframes puck {
    from {
      transform: translateY(-16px) scale(1.2);
      opacity: 0;
    }
  }
  .throw {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    min-height: 90px;
  }
  .dice {
    display: flex;
    gap: 18px;
    padding: 8px 12px;
  }
  .sum {
    font-size: 20px;
    height: 36px;
    min-width: 40px;
    animation: pop 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes pop {
    from {
      transform: scale(0.3);
    }
  }
  .msg {
    text-align: center;
    font-weight: 700;
  }
  .field {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 8px 12px;
    border: 2px solid rgba(255, 244, 210, 0.75);
    border-radius: 40px 40px 10px 10px;
    transition: box-shadow 200ms;
  }
  .field.hit {
    box-shadow:
      0 0 0 2px #ffe39a,
      0 0 20px rgba(255, 215, 106, 0.6);
  }
  .fnums {
    display: flex;
    gap: 10px;
    font-family: Georgia, serif;
    font-weight: 900;
    font-size: 20px;
    color: #fff8e0;
  }
  .fnums .dbl {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid rgba(255, 244, 210, 0.8);
    font-size: 16px;
  }
  .fnums .lit {
    color: #1b1300;
    background: #ffe39a;
    border-radius: 8px;
    padding: 0 4px;
    box-shadow: 0 0 12px rgba(255, 215, 106, 0.9);
  }
  .small {
    font-size: 9px;
  }
  .big {
    font-size: 18px;
    letter-spacing: 0.3em;
  }
  .lines {
    display: grid;
    gap: 6px;
  }
  .band {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 44px;
    border: 2px solid rgba(255, 244, 210, 0.75);
    border-radius: 8px;
    transition:
      background 200ms,
      box-shadow 200ms;
  }
  .band.dont {
    min-height: 34px;
    background: rgba(0, 0, 0, 0.18);
  }
  .band.sel {
    background: rgba(255, 230, 120, 0.12);
    box-shadow: inset 0 0 0 2px rgba(255, 227, 154, 0.6);
  }
  .stack {
    position: absolute;
    right: 18px;
    bottom: 8px;
  }
  .field .stack {
    right: 24px;
    bottom: 14px;
  }
  .center {
    justify-content: center;
    text-align: center;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 520px) {
    .box {
      font-size: 15px;
      height: 42px;
    }
    .fnums {
      gap: 6px;
      font-size: 16px;
    }
  }
</style>
