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
    <strong>{sum.opened}</strong> of {sum.rooms} room{sum.rooms === 1 ? '' : 's'} opened · <strong>{sum.cleared}</strong> of {floors.length} floor{floors.length === 1 ? '' : 's'} cleared
  </p>

  <div class="floors" role="group" aria-label="Floors">
    {#each [...floors].reverse() as f (f.id)}
      <button class="floor-btn" class:on={floor?.id === f.id} aria-pressed={floor?.id === f.id} onclick={() => pickFloor(f.id)} style="--c:{f.color}">
        <span class="lvl">F{f.level}</span>
        <span class="fn">{f.emoji} {f.name}</span>
        <span class="fp">{f.cleared ? '✓ cleared' : `${f.opened}/${f.rooms.length + f.hidden}`}</span>
      </button>
    {/each}
  </div>

  {#if floor}
    <section class="card map-card" aria-label="Floor {floor.level}: {floor.name}" style="--c:{floor.color}">
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
              <li style="grid-column:{r.col + 1};grid-row:{r.row + 1}">
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
  }
  .floors {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .floor-btn {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-elev);
    text-align: start;
    border-inline-start: 4px solid var(--c);
  }
  .floor-btn.on {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, var(--bg-elev));
  }
  .lvl {
    grid-row: span 2;
    font-weight: 800;
    align-self: center;
  }
  .fn {
    font-weight: 600;
    font-size: 13px;
  }
  .fp {
    font-size: 11px;
    color: var(--text-muted);
  }
  h3 {
    margin: 0 0 10px;
    font-size: 15px;
  }
  .map-card {
    background: color-mix(in srgb, #2d2a3e 12%, var(--bg-elev));
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
  }
  .corridors line.lit {
    stroke: color-mix(in srgb, var(--c) 55%, var(--border));
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
  }
  .room {
    width: 72%;
    aspect-ratio: 1;
    border-radius: 10px;
    border: 2px solid var(--border-strong);
    background: var(--bg-elev-2);
    font-size: clamp(14px, 3.4vw, 24px);
    display: grid;
    place-items: center;
    filter: grayscale(0.6);
  }
  .room.open {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 22%, var(--bg-elev));
    filter: none;
  }
  .room.sel {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .detail {
    margin-top: 10px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    min-height: 32px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
