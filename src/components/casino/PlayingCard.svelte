<script lang="ts">
  import type { PlayingCard } from '../../lib/casino/cards';
  import { isRed, rankLabel } from '../../lib/casino/cards';

  interface Props {
    card?: PlayingCard;
    hidden?: boolean;
    held?: boolean;
    small?: boolean;
  }
  let { card, hidden = false, held = false, small = false }: Props = $props();
</script>

{#if hidden || !card}
  <div class="pc back cz-pop" class:small role="img" aria-label="Face-down card"></div>
{:else}
  <div class="pc cz-pop" class:red={isRed(card)} class:held class:small role="img" aria-label="{rankLabel(card.rank)} of {card.suit}">
    <span class="r">{rankLabel(card.rank)}</span>
    <span class="s">{card.suit}</span>
    {#if held}<span class="h">HELD</span>{/if}
  </div>
{/if}

<style>
  .pc {
    position: relative;
    width: 58px;
    height: 82px;
    border-radius: 9px;
    background: linear-gradient(160deg, #ffffff 0%, #f4f4f0 100%);
    color: #1b1b1f;
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 4px 6px;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.08),
      0 1px 0 rgba(255, 255, 255, 0.8) inset,
      0 4px 10px rgba(0, 0, 0, 0.35);
    font-weight: 800;
    user-select: none;
    transition: transform var(--dur) var(--spring);
  }
  /* a glossy highlight across the top corner */
  .pc::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.7) 0%, transparent 45%);
    pointer-events: none;
  }
  .pc:hover {
    transform: translateY(-3px) rotate(-1.5deg);
  }
  .pc.small {
    width: 44px;
    height: 62px;
  }
  .pc.red {
    color: #d63031;
  }
  .r {
    font-size: 16px;
    line-height: 1;
  }
  .s {
    font-size: 30px;
    display: grid;
    place-items: center;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
  }
  .small .s {
    font-size: 22px;
  }
  .back {
    background:
      repeating-linear-gradient(45deg, var(--accent), var(--accent) 6px, color-mix(in srgb, var(--accent) 70%, #fff) 6px, color-mix(in srgb, var(--accent) 70%, #fff) 12px),
      var(--accent);
    border: 3px solid #fff;
    box-shadow:
      inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, #000),
      0 4px 10px rgba(0, 0, 0, 0.35);
  }
  .back::after {
    background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.35), transparent 60%);
  }
  .held {
    outline: 3px solid #ffe066;
    transform: translateY(-8px);
    box-shadow:
      0 0 18px rgba(255, 224, 102, 0.7),
      0 6px 14px rgba(0, 0, 0, 0.35);
  }
  .h {
    position: absolute;
    bottom: -18px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: #ffe066;
    letter-spacing: 0.1em;
    text-shadow: 0 0 8px rgba(255, 224, 102, 0.8);
  }
</style>
