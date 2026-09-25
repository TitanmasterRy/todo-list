// The study room you're in: saved on this device, ticking in the background (so the chime plays on any view),
// with a chime, a notification when the tab is hidden, and a pomodoro counted for each focus round you saw start.
import { decodeRoom, encodeRoom, phaseAt, PHASE_LABEL, totalMs, type RoomState, type StudyRoom } from '../studyroom';
import { playSound } from '../sounds';
import { notify } from '../reminders';
import { toasts } from '../toast.svelte';
import { store } from '../store.svelte';
import { ROOM_KEY } from './links';
import { socialUi } from './state.svelte';

interface Saved {
  code: string;
  chime: boolean;
  name?: string; // shown to others when presence is on
  presence?: boolean;
}

function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(ROOM_KEY) ?? 'null') as Saved | null;
    return s && typeof s.code === 'string' ? s : null;
  } catch {
    return null;
  }
}

class RoomRuntime {
  room = $state<StudyRoom | null>(null);
  now = $state(Date.now());
  chime = $state(true);
  presence = $state(false);
  myName = $state('');
  people = $state<string[] | null>(null); // who's in (only with presence)
  presenceError = $state('');
  state = $derived<RoomState | null>(this.room ? phaseAt(this.room, this.now) : null);
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastIndex = -2;
  private sawWorkStart = false;
  private leavePresence: (() => void) | null = null;

  /** Join a room (from a link or the create form). */
  join(room: StudyRoom): void {
    this.leave(false);
    this.room = room;
    this.now = Date.now();
    this.lastIndex = phaseAt(room, this.now).index;
    this.sawWorkStart = false;
    this.save();
    this.timer = setInterval(() => this.tick(), 500);
    socialUi.roomOpen = true;
    if (this.presence) void this.startPresence();
  }

  /** Back into the saved room after a reload (dropped an hour after a finished room ends). */
  resume(): void {
    const s = load();
    const room = s ? decodeRoom(s.code) : null;
    if (!s || !room) return;
    if (Date.now() > room.start + totalMs(room) + 3600_000) return this.leave();
    this.chime = s.chime !== false;
    this.myName = s.name ?? '';
    this.presence = !!s.presence;
    this.join(room);
  }

  leave(close = true): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stopPresence();
    this.room = null;
    if (close) {
      socialUi.roomOpen = false;
      try {
        localStorage.removeItem(ROOM_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  setChime(on: boolean): void {
    this.chime = on;
    this.save();
  }

  async setPresence(on: boolean, name: string): Promise<void> {
    this.presence = on;
    this.myName = name.trim().slice(0, 24);
    this.save();
    this.stopPresence();
    if (on) await this.startPresence();
  }

  private save(): void {
    if (!this.room) return;
    try {
      const s: Saved = { code: encodeRoom(this.room), chime: this.chime, name: this.myName || undefined, presence: this.presence || undefined };
      localStorage.setItem(ROOM_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  private tick(): void {
    if (!this.room) return;
    this.now = Date.now();
    const s = phaseAt(this.room, this.now);
    if (s.index === this.lastIndex) return;
    const prev = this.lastIndex;
    this.lastIndex = s.index;
    // a focus round you were here for from its start counts as a pomodoro
    if (this.sawWorkStart && prev >= 0 && prev % 2 === 0 && s.index === prev + 1) store.recordPomodoro();
    this.sawWorkStart = s.phase === 'work' && s.index === prev + 1;
    this.announce(s);
  }

  private announce(s: RoomState): void {
    if (this.chime) playSound('timerDone', true);
    const room = this.room?.name ?? 'Study room';
    const body = s.phase === 'work' ? `Round ${s.round}: focus.` : s.phase === 'done' ? 'The room is finished. Nice work.' : `${PHASE_LABEL[s.phase]}. Round ${s.round} done.`;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') notify(`👥 ${room}: ${PHASE_LABEL[s.phase]}`, body, 'study-room');
    else toasts.push({ message: `${room}: ${PHASE_LABEL[s.phase]}`, detail: body, kind: 'info', emoji: s.phase === 'work' ? '🍅' : '☕' });
  }

  private async startPresence(): Promise<void> {
    if (!this.room) return;
    this.presenceError = '';
    try {
      const { joinPresence } = await import('./presence');
      this.leavePresence = await joinPresence(this.room.id, this.myName || 'Someone', (names) => (this.people = names));
    } catch (e) {
      this.people = null;
      this.presenceError = e instanceof Error ? e.message : String(e);
    }
  }

  private stopPresence(): void {
    this.leavePresence?.();
    this.leavePresence = null;
    this.people = null;
  }
}

export const studyRoom = new RoomRuntime();
