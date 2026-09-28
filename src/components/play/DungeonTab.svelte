<script lang="ts">
  // Play → Dungeon: each course is a floor, each of its tasks a room. Finishing a task opens its room.
  import { store } from '../../lib/store.svelte';
  import { buildDungeon, dungeonSummary, ROOM_ICON, ROOM_LABEL, type Room } from '../../lib/dungeon';
  import { formatDue } from '../../lib/dates';

  const floors = $derived(buildDungeon(store.courses, store.tasks));
  const sum = $derived(dungeonSummary(floors));
  let floorId = $state<string | null>(null);
  const floor = $derived(floors.find((f) => f.id === floorId) ?? floors.find((f) => !f.cleared && f.rooms.length) ?? floors[0]);
  let picked = $state<Room | null>(null);
  const pickedRoom = $derived(picked && floor?.rooms.find((r) => r.taskId === picked!.taskId));

  function pickFloor(id: string) {
    floorId = id;
    picked = null;
  }
</script>

{#if !floors.length}
  <div class="card">
    <p>The dungeon is still sealed.</p>
    <p class="muted">Add a course or a task: each course becomes a floor and each task a room. Finish tasks to open the rooms.</p>
  </div>
{:else}
  <p class="summary" data-dungeon-summary>
    <strong
      >{#key sum.opened}<span class="grad-text bump">{sum.opened}</span>{/key}</strong
    >
    of {sum.rooms} room{sum.rooms === 1 ? '' : 's'} opened ·
    <strong
      >{#key sum.cleared}<span class="gold-text bump">{sum.cleared}</span>{/key}</strong
    >
    of {floors.length} floor{floors.length === 1 ? '' : 's'} cleared
  </p>

  <div class="floors" role="group" aria-label="Floors">
    {#each [...floors].reverse() as f (f.id)}
      <button class="floor-btn" class:on={floor?.id === f.id} class:cleared={f.cleared} aria-pressed={floor?.id === f.id} onclick={() => pickFloor(f.id)} style="--c:{f.color}">
        <span class="lvl">F{f.level}</span>
        <span class="fn">{f.emoji} {f.name}</span>
        <span class="fp">{f.cleared ? '✓ cleared' : `${f.opened}/${f.rooms.length + f.hidden}`}</span>
      </button>
    {/each}
  </div>

  {#if floor}
    <section class="card map-card" class:cleared={floor.cleared} aria-label="Floor {floor.level}: {floor.name}" style="--c:{floor.color}">
      <h3>Floor {floor.level} · {floor.emoji} {floor.name}{floor.cleared ? ' · cleared! 🏆' : ''}</h3>
      {#if !floor.rooms.length}
        <p class="muted">No rooms yet. Add a task to this course.</p>
      {:else}
        <div class="map" style="--cols:{floor.cols};--rows:{floor.rows}">
          <svg class="corridors" viewBox="0 0 {floor.cols * 100} {floor.rows * 100}" preserveAspectRatio="none" aria-hidden="true">
            {#each floor.rooms.slice(1) as r, i (r.taskId)}
              {@const a = floor.rooms[i]}
              <line x1={a.col * 100 + 50} y1={a.row * 100 + 50} x2={r.col * 100 + 50} y2={r.row * 100 + 50} class:lit={a.open && r.open} />
            {/each}
          </svg>
          <ol class="rooms">
            {#each floor.rooms as r, i (r.taskId)}
              <li style="grid-column:{r.col + 1};grid-row:{r.row + 1};--i:{i}">
                <button
                  class="room"
                  class:open={r.open}
                  class:sel={pickedRoom?.taskId === r.taskId}
                  data-room
                  data-open={r.open}
                  aria-label="Room {i + 1}: {r.title}, {r.open ? `${ROOM_LABEL[r.kind]}, opened` : 'locked'}"
                  onclick={() => (picked = r)}
                >
                  <span aria-hidden="true">{r.open ? ROOM_ICON[r.kind] : '🔒'}</span>
                </button>
              </li>
            {/each}
          </ol>
        </div>
        {#if floor.hidden}<p class="muted">{floor.hidden} older room{floor.hidden === 1 ? '' : 's'} not shown.</p>{/if}
      {/if}
      <div class="detail" aria-live="polite">
        {#if pickedRoom}
          <strong>{pickedRoom.open ? ROOM_ICON[pickedRoom.kind] : '🔒'} {pickedRoom.title}</strong>
          <span class="muted"
            >{pickedRoom.open
              ? `${ROOM_LABEL[pickedRoom.kind]} · opened ${new Date(pickedRoom.completedAt!).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
              : `Locked · finish the task to open it${pickedRoom.due ? ` · due ${formatDue(pickedRoom.due, store.now, store.settings.timeFormat)}` : ''}`}</span
          >
          <button class="btn sm" onclick={() => (store.editingTaskId = pickedRoom!.taskId)}>Open task</button>
        {:else}
          <span class="muted">Pick a room to see its task. 🐉 boss lairs are exams and quizzes, 📚 libraries readings, ⚒️ forges projects, 💎 treasure high-priority work.</span>
        {/if}
      </div>
    </section>
  {/if}
{/if}

<style>
  .summary {
    margin: 0 0 10px;
    font-variant-numeric: tabular-nums;
  }
  .summary strong {
    font-size: 18px;
    font-weight: 900;
  }
  .floors {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  /* floor tabs: chunky cards tinted by the course color; the open one glows, cleared ones turn gold */
  .floor-btn {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0 8px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-elev);
    text-align: start;
    border-inline-start: 4px solid var(--c);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur),
      box-shadow var(--dur),
      background var(--dur);
  }
  .floor-btn:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--c) 60%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 20px -8px color-mix(in srgb, var(--c) 70%, transparent);
  }
  .floor-btn.on {
    border-color: var(--c);
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, var(--bg-elev)), var(--bg-elev));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 24px -8px color-mix(in srgb, var(--c) 80%, transparent);
  }
  .floor-btn.cleared {
    border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-elev)), var(--bg-elev) 70%);
  }
  .floor-btn.cleared .fp {
    color: var(--warn-text);
    font-weight: 700;
  }
  .lvl {
    grid-row: span 2;
    font-weight: 900;
    align-self: center;
    font-variant-numeric: tabular-nums;
    color: var(--c);
  }
  .fn {
    font-weight: 700;
    font-size: 13px;
  }
  .fp {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 800;
  }
  /* the floor: a dark stone card with a course-colored spotlight; a cleared floor gets a gold edge */
  .map-card {
    position: relative;
    overflow: hidden;
    background: radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--c) 18%, transparent), transparent 70%), color-mix(in srgb, #2d2a3e 18%, var(--bg-elev));
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .map-card.cleared {
    border-color: transparent;
    background:
      linear-gradient(color-mix(in srgb, #2d2a3e 18%, var(--bg-elev)), color-mix(in srgb, #2d2a3e 18%, var(--bg-elev))) padding-box,
      var(--grad-gold) border-box;
    box-shadow:
      var(--shadow-sm),
      0 0 34px -10px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .map-card.cleared h3 {
    background: var(--grad-gold);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .map {
    position: relative;
    max-width: 560px;
    margin: 0 auto;
    aspect-ratio: var(--cols) / var(--rows);
  }
  .corridors {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .corridors line {
    stroke: var(--border-strong);
    stroke-width: 14;
    stroke-linecap: round;
    transition: stroke var(--dur-slow);
  }
  .corridors line.lit {
    stroke: color-mix(in srgb, var(--c) 60%, var(--border));
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c) 70%, transparent));
  }
  .rooms {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    height: 100%;
  }
  .rooms li {
    display: grid;
    place-items: center;
    animation: rise-in 360ms var(--ease) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }
  /* rooms: little cards that lift on hover; open ones glow in the course color, cleared floors turn them gold */
  .room {
    position: relative;
    width: 72%;
    aspect-ratio: 1;
    border-radius: 12px;
    border: 2px solid var(--border-strong);
    background: linear-gradient(180deg, var(--bg-hover), var(--bg-elev-2));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    font-size: clamp(14px, 3.4vw, 24px);
    display: grid;
    place-items: center;
    filter: grayscale(0.6);
    transition:
      transform var(--dur-slow) var(--spring),
      box-shadow var(--dur),
      border-color var(--dur);
  }
  .room:hover {
    transform: translateY(-3px) scale(1.06);
    border-color: color-mix(in srgb, var(--c) 60%, var(--border-strong));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      0 0 20px -6px color-mix(in srgb, var(--c) 60%, transparent);
  }
  .room.open {
    border-color: var(--c);
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 34%, var(--bg-elev)), color-mix(in srgb, var(--c) 12%, var(--bg-elev)));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 0 22px -6px color-mix(in srgb, var(--c) 80%, transparent);
    filter: none;
  }
  .room.open span {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
  }
  .cleared .room.open {
    border-color: color-mix(in srgb, var(--gold) 70%, var(--c));
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 34%, var(--bg-elev)), color-mix(in srgb, var(--c) 14%, var(--bg-elev)));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 0 22px -6px color-mix(in srgb, var(--gold) 80%, transparent);
  }
  .room.sel {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--glow-strong);
  }
  .detail {
    margin-top: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    min-height: 32px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--bg-elev-2) 70%, transparent);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
