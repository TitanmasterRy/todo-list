<script lang="ts">
  // Play → Garden (Nature theme): every finished task is a growth step. Four steps grow a plant from sprout to bloom,
  // in the color of the course that planted it; twelve plants fill a bed.
  import { store } from '../../lib/store.svelte';
  import { BED_SIZE, buildGarden, STAGES, stepsToBloom, type Plant } from '../../lib/garden';

  const garden = $derived(
    buildGarden(
      store.tasks
        .filter((t) => t.completedAt)
        .map((t) => {
          const c = store.courseById(t.courseId);
          return { id: t.id, at: t.completedAt!, color: c?.color, course: c?.name };
        }),
    ),
  );
  let bedIdx = $state<number | null>(null);
  const bed = $derived(Math.min(bedIdx ?? garden.beds.length - 1, garden.beds.length - 1));
  const plants = $derived(garden.beds[bed]);
  const growing = $derived(garden.beds[garden.beds.length - 1].find((p) => p.stage < STAGES.length - 1));
  const COLS = 4;
  const W = 100;
  const H = 140;
  const KIND_NAME = { daisy: 'Daisy', tulip: 'Tulip', sunflower: 'Sunflower', rose: 'Rose', bluebell: 'Bluebell' };
  const describe = (p: Plant) =>
    `${KIND_NAME[p.kind]}${p.course ? ` from ${p.course}` : ''}: ${p.stage === 4 ? 'in bloom' : p.stage === 0 ? 'a seed' : `${STAGES[p.stage]}, ${stepsToBloom(p)} to bloom`}`;
  const petals = (n: number, r: number) => Array.from({ length: n }, (_, i) => ({ x: Math.cos((i / n) * Math.PI * 2) * r, y: Math.sin((i / n) * Math.PI * 2) * r }));
</script>

<p class="summary" data-garden-summary>
  <strong
    >{#key garden.steps}<span class="grad-text bump">{garden.steps}</span>{/key}</strong
  >
  task{garden.steps === 1 ? '' : 's'} finished ·
  <strong
    >{#key garden.blooms}<span class="gold-text bump">{garden.blooms}</span>{/key}</strong
  >
  plant{garden.blooms === 1 ? '' : 's'} in bloom{#if growing}
    · next bloom in {stepsToBloom(growing)} task{stepsToBloom(growing) === 1 ? '' : 's'}{/if}
</p>

{#if garden.beds.length > 1}
  <div class="nav">
    <button class="btn ghost sm" aria-label="Previous bed" disabled={bed === 0} onclick={() => (bedIdx = bed - 1)}>‹</button>
    <strong>Bed {bed + 1} of {garden.beds.length}</strong>
    <button class="btn ghost sm" aria-label="Next bed" disabled={bed === garden.beds.length - 1} onclick={() => (bedIdx = bed + 1)}>›</button>
  </div>
{/if}

<div class="card bed">
  <span class="sun" aria-hidden="true"></span>
  <svg
    viewBox="0 0 {COLS * W} {Math.ceil(BED_SIZE / COLS) * H}"
    role="img"
    aria-label="Garden bed {bed + 1}: {plants.filter((p) => p.stage === 4).length} of {plants.length} plants in bloom"
  >
    <rect x="0" y="0" width={COLS * W} height={Math.ceil(BED_SIZE / COLS) * H} rx="14" class="grass" />
    {#each Array.from({ length: BED_SIZE }, (_, i) => i) as i (i)}
      {@const p = plants[i]}
      {@const cx = (i % COLS) * W + W / 2}
      {@const base = Math.floor(i / COLS) * H + H - 22}
      <ellipse {cx} cy={base + 6} rx="34" ry="10" class="soil" />
      {#if p}
        <g class="plant" data-stage={p.stage} style="--d:{(i % 4) * 0.7}s">
          <title>{describe(p)}</title>
          <g class="sway"
            ><g transform="translate({cx} {base}) scale(1.35) translate({-cx} {-base})">
              {#if p.stage === 0}
                <ellipse {cx} cy={base + 2} rx="5" ry="3.5" fill="#7a4e2d" />
              {:else}
                {@const h = [0, 18, 36, 52, 62][p.stage]}
                <path d="M{cx} {base} q -4 {-h / 2} 0 {-h}" stroke="#3f8f3a" stroke-width="4" fill="none" stroke-linecap="round" />
                <ellipse cx={cx - 9} cy={base - h * 0.35} rx={4 + p.stage * 2} ry={3 + p.stage} transform="rotate(-30 {cx - 9} {base - h * 0.35})" fill="#5cb85c" />
                <ellipse cx={cx + 9} cy={base - h * 0.55} rx={4 + p.stage * 2} ry={3 + p.stage} transform="rotate(30 {cx + 9} {base - h * 0.55})" fill="#4cae4c" />
                {#if p.stage === 3}
                  <ellipse {cx} cy={base - h - 4} rx="6" ry="9" fill={p.color} stroke="rgba(0,0,0,0.25)" />
                {:else if p.stage === 4}
                  {@const fy = base - h - 8}
                  {#if p.kind === 'tulip'}
                    <path d="M{cx - 12} {fy - 6} q 0 18 12 18 q 12 0 12 -18 l -6 6 l -6 -10 l -6 10 z" fill={p.color} stroke="rgba(0,0,0,0.25)" />
                  {:else if p.kind === 'bluebell'}
                    {#each [-10, 0, 10] as dx (dx)}<path d="M{cx + dx - 5} {fy + Math.abs(dx) / 2} q 5 -12 10 0 q -5 4 -10 0" fill={p.color} stroke="rgba(0,0,0,0.25)" />{/each}
                  {:else}
                    {@const n = p.kind === 'sunflower' ? 12 : p.kind === 'rose' ? 6 : 8}
                    {#each petals(n, p.kind === 'sunflower' ? 12 : 9) as q, k (k)}
                      <ellipse
                        cx={cx + q.x}
                        cy={fy + q.y}
                        rx={p.kind === 'rose' ? 8 : 6}
                        ry={p.kind === 'rose' ? 8 : 5}
                        fill={p.kind === 'sunflower' ? '#f7c948' : p.color}
                        stroke="rgba(0,0,0,0.18)"
                      />
                    {/each}
                    <circle
                      {cx}
                      cy={fy}
                      r={p.kind === 'sunflower' ? 8 : 5}
                      fill={p.kind === 'sunflower' ? '#6b4226' : p.kind === 'rose' ? p.color : '#ffd966'}
                      stroke="rgba(0,0,0,0.2)"
                    />
                  {/if}
                {/if}
              {/if}
            </g></g
          >
        </g>
      {/if}
    {/each}
  </svg>
</div>

<ul class="visually-hidden">
  {#each plants as p (p.index)}<li>{describe(p)}</li>{/each}
</ul>
<p class="muted">
  Each task you finish grows the next plant a step; its color comes from the task's course. Undoing a completion takes the step back. The Nature theme's arcade game is Fishing.
</p>

<style>
  .summary {
    margin: 0 0 10px;
    font-variant-numeric: tabular-nums;
  }
  .summary strong {
    font-size: 18px;
    font-weight: 900;
  }
  .nav {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .nav strong {
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
    font-variant-numeric: tabular-nums;
  }
  /* the bed: a sky gradient over the grass with a warm sun glow in the corner */
  .bed {
    position: relative;
    padding: 8px;
    overflow: hidden;
    background: linear-gradient(180deg, color-mix(in srgb, var(--info) 14%, var(--bg-elev)), color-mix(in srgb, #7bc47f 12%, var(--bg-elev)) 70%, var(--bg-elev));
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .sun {
    position: absolute;
    top: -40px;
    right: -40px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--gold) 45%, transparent), color-mix(in srgb, var(--gold) 12%, transparent) 45%, transparent 70%);
    animation: sunshine 6s ease-in-out infinite;
    pointer-events: none;
  }
  :global([dir='rtl']) .sun {
    right: auto;
    left: -40px;
  }
  svg {
    position: relative;
    width: 100%;
    max-width: 560px;
    display: block;
    margin: 0 auto;
  }
  .grass {
    fill: color-mix(in srgb, #7bc47f 30%, var(--bg-elev));
  }
  .soil {
    fill: #8d5b3a;
    opacity: 0.8;
  }
  /* plants grow in when planted, then sway gently; blooms get a warm glow */
  .plant {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: grow 500ms ease-out;
  }
  .sway {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: sway 4.2s ease-in-out infinite;
    animation-delay: var(--d, 0s);
  }
  .plant[data-stage='0'] .sway {
    animation: none;
  }
  .plant[data-stage='4'] {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--gold) 55%, transparent));
  }
  @keyframes grow {
    from {
      transform: scale(0.6);
      opacity: 0.4;
    }
  }
  @keyframes sway {
    0%,
    100% {
      transform: rotate(-2deg) translateY(0);
    }
    50% {
      transform: rotate(2deg) translateY(-1.5px);
    }
  }
  @keyframes sunshine {
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
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
