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
    <div class="cz-row">
      <div class="dice" class:roll={rolling} aria-live="polite">{s.last ? `${FACES[s.last[0] - 1]} ${FACES[s.last[1] - 1]}` : '🎲 🎲'}</div>
      <div>
        <div class="cz-label">Point</div>
        <div class="point">{s.point ?? 'Off'}</div>
      </div>
    </div>
    <div>{s.message}</div>
    <div class="cz-result" class:win={lastNet !== null && lastNet > 0} class:lose={lastNet !== null && lastNet < 0}>{lastNet === null ? '' : lastNet > 0 ? `+${lastNet}` : lastNet < 0 ? `${lastNet}` : 'Even'}</div>
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
    <button class="btn primary" onclick={roll} disabled={rolling || (!lineOn && lineBet + fieldBet <= 0) || (!lineOn ? lineBet : 0) + fieldBet > economy.wallet.chips}>{lineOn ? 'Roll for the point' : 'Come-out roll'}</button>
  </div>
  <p class="cz-edge">Pass wins on 7/11 and loses on 2/3/12 on the come-out; otherwise that number is the point, and you need it again before a 7. Don't pass is the opposite (12 pushes). Field pays 1:1 on 3, 4, 9, 10, 11, 2:1 on 2 and 3:1 on 12. House edge: pass 1.41%, don't pass 1.36%, field 2.8%.</p>
</div>

<style>
  .dice {
    font-size: 54px;
    line-height: 1;
  }
  .dice.roll {
    animation: shake 0.15s linear infinite;
  }
  @keyframes shake {
    50% {
      transform: rotate(8deg) translateY(-3px);
    }
  }
  .point {
    font-size: 28px;
    font-weight: 800;
  }
</style>
