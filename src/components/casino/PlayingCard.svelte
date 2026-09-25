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
    width: 56px;
    height: 80px;
    border-radius: 8px;
    background: #fdfdfb;
    color: #1b1b1f;
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 4px 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    position: relative;
    font-weight: 700;
    user-select: none;
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
    font-size: 28px;
    display: grid;
    place-items: center;
  }
  .small .s {
    font-size: 22px;
  }
  .back {
    background: repeating-linear-gradient(45deg, var(--accent), var(--accent) 6px, color-mix(in srgb, var(--accent) 70%, #fff) 6px, color-mix(in srgb, var(--accent) 70%, #fff) 12px);
    border: 3px solid #fff;
  }
  .held {
    outline: 3px solid #ffe066;
    transform: translateY(-6px);
  }
  .h {
    position: absolute;
    bottom: -18px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: #ffe066;
    letter-spacing: 0.08em;
  }
</style>
