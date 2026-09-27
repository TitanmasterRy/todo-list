<script lang="ts">
  // Play → Pet (Cute theme): a little friend you feed with coins. It gets hungry and a bit lonely over real time,
  // perks up when you finish tasks, and never dies: at worst it naps until you're back.
  import { store } from '../../lib/store.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { canFeed, FOODS, hoursUntilHungry, MOOD_TEXT, petState, SPECIES, type Food, type PetEvent, type SpeciesId } from '../../lib/pet';

  const KEY = 'homework-todo:pet';
  const PAT_GAP_MS = 10 * 60_000; // a pat counts once every 10 minutes
  interface Profile {
    name: string;
    species: SpeciesId;
    bornAt: number;
    pats: number[];
  }
  function load(): Profile {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
      if (p && typeof p.bornAt === 'number')
        return {
          name: typeof p.name === 'string' ? p.name.slice(0, 20) : 'Mochi',
          species: SPECIES.some((s) => s.id === p.species) ? p.species! : 'cat',
          bornAt: p.bornAt,
          pats: Array.isArray(p.pats) ? p.pats.filter((x) => typeof x === 'number').slice(-30) : [],
        };
    } catch {
      /* fall through */
    }
    return { name: 'Mochi', species: 'cat', bornAt: Date.now(), pats: [] };
  }
  let profile = $state<Profile>(load());
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }
  persist();

  let bump = $state(0); // re-render now after feeding or a pat
  const species = $derived(SPECIES.find((s) => s.id === profile.species) ?? SPECIES[0]);
  const feeds = $derived(store.ledger.filter((e) => e.reason.startsWith('pet:') && e.currency === 'coins'));
  // adopted when first opened here, or earlier if another device fed it first (the ledger syncs)
  const bornAt = $derived(Math.min(profile.bornAt, ...feeds.map((e) => Date.parse(e.at))));
  const ps = $derived.by(() => {
    void bump;
    const now = Math.max(store.now.getTime(), Date.now());
    const events: PetEvent[] = [
      ...feeds.map((e) => ({ at: Date.parse(e.at), kind: 'feed' as const, food: e.reason.slice(4) })),
      ...profile.pats.map((at) => ({ at, kind: 'pat' as const })),
      ...store.tasks.filter((t) => t.completedAt).map((t) => ({ at: Date.parse(t.completedAt!), kind: 'task' as const })),
    ];
    return petState(events, bornAt, now);
  });
  let reaction = $state('');

  function feed(f: Food) {
    if (!canFeed(ps)) {
      reaction = `${profile.name} is full!`;
      return;
    }
    if (economy.wallet.coins < f.price) {
      toasts.push({ message: `Needs ${f.price} coins`, detail: 'Finish a task to earn more.', kind: 'warn', emoji: '🪙' });
      return;
    }
    store.addLedger([{ currency: 'coins', amount: -f.price, reason: `pet:${f.id}` }]);
    reaction = `${profile.name} munches the ${f.name.toLowerCase()} ${f.emoji}`;
    playSound('pop');
    bump++;
  }
  function pat() {
    const now = Date.now();
    const last = profile.pats[profile.pats.length - 1] ?? 0;
    if (now - last >= PAT_GAP_MS) {
      profile = { ...profile, pats: [...profile.pats, now].slice(-30) };
      persist();
      bump++;
    }
    reaction = `${profile.name} ${profile.species === 'cat' ? 'purrs' : 'wiggles happily'} 💕`;
  }
  function rename(e: Event) {
    profile = { ...profile, name: (e.currentTarget as HTMLInputElement).value.trim().slice(0, 20) || 'Mochi' };
    persist();
  }
  function setSpecies(id: SpeciesId) {
    profile = { ...profile, species: id };
    persist();
  }
  const hungryIn = $derived(Math.round(hoursUntilHungry(ps)));
</script>

<div class="pet-wrap">
  <section class="card stage mood-{ps.mood}" aria-label="{profile.name} the {species.name.toLowerCase()}">
    <svg class="pet" viewBox="0 0 160 160" role="img" aria-label="{profile.name} {MOOD_TEXT[ps.mood]}" data-mood={ps.mood}>
      <ellipse cx="80" cy="146" rx="46" ry="7" fill="rgba(0,0,0,0.12)" />
      <g class="body">
        {#if species.id === 'cat'}
          <path d="M40 62 L48 22 L70 50 Z M120 62 L112 22 L90 50 Z" fill={species.color} stroke="rgba(0,0,0,0.25)" stroke-width="2" />
        {:else if species.id === 'bunny'}
          <ellipse cx="60" cy="30" rx="10" ry="28" fill={species.color} stroke="rgba(0,0,0,0.2)" stroke-width="2" />
          <ellipse cx="100" cy="30" rx="10" ry="28" fill={species.color} stroke="rgba(0,0,0,0.2)" stroke-width="2" />
        {:else if species.id === 'chick'}
          <path d="M74 44 Q78 28 84 40 Q90 26 90 46" fill="none" stroke="#e0a800" stroke-width="3" />
        {:else if species.id === 'frog'}
          <circle cx="58" cy="56" r="16" fill={species.color} />
          <circle cx="102" cy="56" r="16" fill={species.color} />
        {/if}
        <ellipse cx="80" cy="96" rx="54" ry="48" fill={species.color} stroke="rgba(0,0,0,0.22)" stroke-width="2" />
        <ellipse cx="80" cy="112" rx="30" ry="22" fill="rgba(255,255,255,0.35)" />
        <!-- eyes -->
        {#if ps.mood === 'sleepy'}
          <path d="M54 88 q8 6 16 0 M90 88 q8 6 16 0" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round" />
        {:else if ps.mood === 'happy'}
          <path d="M54 90 q8 -10 16 0 M90 90 q8 -10 16 0" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round" />
        {:else}
          <circle cx="62" cy="88" r="7" fill="#2b2b2b" /><circle cx="98" cy="88" r="7" fill="#2b2b2b" />
          <circle cx="64" cy="85" r="2.2" fill="#fff" /><circle cx="100" cy="85" r="2.2" fill="#fff" />
        {/if}
        {#if ps.mood === 'sad'}<path class="tear" d="M100 98 q-4 8 0 10 q4 -2 0 -10" fill="#6fa8dc" />{/if}
        <ellipse cx="50" cy="104" rx="8" ry="5" fill="#ff9ecb" opacity="0.6" />
        <ellipse cx="110" cy="104" rx="8" ry="5" fill="#ff9ecb" opacity="0.6" />
        <!-- mouth -->
        {#if ps.mood === 'happy'}
          <path d="M66 104 q14 16 28 0 z" fill="#8b3a3a" />
        {:else if ps.mood === 'content'}
          <path d="M70 106 q10 8 20 0" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round" />
        {:else if ps.mood === 'hungry'}
          <ellipse cx="80" cy="108" rx="6" ry="7" fill="#8b3a3a" />
        {:else if ps.mood === 'sad'}
          <path d="M70 112 q10 -8 20 0" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round" />
        {:else}
          <path d="M74 108 h12" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round" />
        {/if}
      </g>
      {#if ps.mood === 'sleepy'}<text class="zzz" x="118" y="44" font-size="20">z Z</text>{/if}
      {#if ps.mood === 'happy'}<text class="hearts" x="116" y="40" font-size="18">💕</text>{/if}
    </svg>
    <div class="info">
      <h2>{profile.name} <span class="muted">the {species.name.toLowerCase()}</span></h2>
      <p class="mood" data-pet-mood>{profile.name} {MOOD_TEXT[ps.mood]}.</p>
      <div class="meter">
        <span>Fullness</span>
        <span class="bar" role="progressbar" aria-label="Fullness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={ps.fill}
          ><span class="fill f" style="width:{ps.fill}%"></span></span
        >
        <span class="num" data-pet-fill>{ps.fill}</span>
      </div>
      <div class="meter">
        <span>Happiness</span>
        <span class="bar" role="progressbar" aria-label="Happiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={ps.joy}
          ><span class="fill j" style="width:{ps.joy}%"></span></span
        >
        <span class="num">{ps.joy}</span>
      </div>
      <p class="muted">
        {hungryIn > 0 ? `Gets hungry in about ${hungryIn} hour${hungryIn === 1 ? '' : 's'}.` : 'Hungry now.'} Finishing tasks cheers it up; it never runs away or gets sick.
      </p>
      <p class="react" aria-live="polite">{reaction}</p>
    </div>
  </section>

  <section class="card">
    <h3>Feed {profile.name}</h3>
    <div class="foods">
      {#each FOODS as f (f.id)}
        <button class="btn food" onclick={() => feed(f)} disabled={economy.wallet.coins < f.price || !canFeed(ps)} aria-label="Feed {f.name} for {f.price} coins">
          <span class="fe" aria-hidden="true">{f.emoji}</span>
          <span>{f.name}</span>
          <span class="muted">{f.price} 🪙 · +{f.fill} full · +{f.joy} happy</span>
        </button>
      {/each}
      <button class="btn food" onclick={pat} aria-label="Pat {profile.name}">
        <span class="fe" aria-hidden="true">🤚</span>
        <span>Pat</span>
        <span class="muted">free · +5 happy (every 10 min)</span>
      </button>
    </div>
    {#if !canFeed(ps)}<p class="muted">{profile.name} is full. Come back in a few hours.</p>{/if}
    <details class="opts">
      <summary>Name and look</summary>
      <label class="field">Name <input class="input" value={profile.name} maxlength="20" onchange={rename} aria-label="Pet name" /></label>
      <div class="species" role="group" aria-label="Pet type">
        {#each SPECIES as s (s.id)}
          <button class="btn sm" class:primary={profile.species === s.id} aria-pressed={profile.species === s.id} onclick={() => setSpecies(s.id)}>{s.emoji} {s.name}</button>
        {/each}
      </div>
    </details>
  </section>
  <p class="muted">Food is paid for with coins (it shows in your Wallet history). The Cute theme's arcade game is Bubble pop.</p>
</div>

<style>
  .pet-wrap {
    display: grid;
    gap: 10px;
  }
  .stage {
    display: grid;
    grid-template-columns: minmax(140px, 200px) 1fr;
    gap: 16px;
    align-items: center;
  }
  @media (max-width: 520px) {
    .stage {
      grid-template-columns: 1fr;
      justify-items: center;
    }
  }
  .pet {
    width: 100%;
    max-width: 200px;
  }
  .mood-happy .body {
    animation: bounce 1.4s ease-in-out infinite;
    transform-origin: 80px 140px;
  }
  .mood-sleepy .body {
    animation: breathe 3s ease-in-out infinite;
    transform-origin: 80px 140px;
  }
  .zzz {
    fill: var(--text-muted);
    font-weight: 700;
  }
  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scale(1, 1);
    }
    50% {
      transform: scale(1.02, 0.98);
    }
  }
  :global(:root.reduced-motion) .body {
    animation: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .body {
      animation: none !important;
    }
  }
  h2 {
    margin: 0 0 4px;
    font-size: 20px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .mood {
    margin: 0 0 8px;
  }
  .meter {
    display: grid;
    grid-template-columns: 80px 1fr 32px;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .bar {
    height: 10px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    transition: width var(--dur);
  }
  .f {
    background: #f4a261;
  }
  .j {
    background: #ff6fae;
  }
  .num {
    font-variant-numeric: tabular-nums;
    text-align: end;
  }
  .foods {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .food {
    display: grid;
    justify-items: start;
    gap: 2px;
    text-align: start;
    height: auto;
    padding: 10px;
  }
  .fe {
    font-size: 24px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .react {
    min-height: 18px;
    font-size: 13px;
    margin: 4px 0 0;
  }
  .opts {
    margin-top: 10px;
    font-size: 13px;
  }
  .opts summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  .field {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 8px 0;
  }
  .species {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
</style>
