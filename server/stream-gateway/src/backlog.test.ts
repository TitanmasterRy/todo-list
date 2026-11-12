import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputOrder, MAX_DRAIN_MS, VideoGate, backlogBudget, clockNotice, gatewayMessage } from './backlog.js';

const video = (key: boolean, size = 10) => Uint8Array.from({ length: size }, (_, i) => (i === 0 ? 1 : i === 1 ? (key ? 1 : 0) : 0));
const audio = Uint8Array.of(2, 0, 9, 9);

describe('backlogBudget', () => {
  it('allows about a quarter second of video, at least 128 KB', () => {
    expect(backlogBudget(20_000)).toBe(625_000);
    expect(backlogBudget(1_000)).toBe(128 * 1024);
  });
});

describe('VideoGate', () => {
  it('passes everything while the browser keeps up', () => {
    const gate = new VideoGate(1000, () => {});
    expect(gate.pass(video(true), 0)).toBe(true);
    expect(gate.pass(video(false), 900)).toBe(true);
    expect(gate.pass(audio, 10_000_000)).toBe(true);
  });

  it('drops video once the queue passes the budget, and resumes at a keyframe asked for after it drains', () => {
    let t = 0;
    const asks: number[] = [];
    const gate = new VideoGate(
      1000,
      () => asks.push(t),
      () => t,
    );
    expect(gate.pass(video(false), 1500)).toBe(false);
    // still draining: no keyframe asked for yet, and a keyframe now would arrive stale, so it's dropped too
    expect(gate.pass(video(true), 800)).toBe(false);
    expect(asks).toEqual([]);
    // drained: ask once (not on every frame), keep dropping deltas
    expect(gate.pass(video(false), 100)).toBe(false);
    t = 100;
    expect(gate.pass(video(false), 100)).toBe(false);
    expect(asks).toEqual([0]);
    t = 600;
    expect(gate.pass(video(false), 100)).toBe(false);
    expect(asks).toEqual([0, 600]);
    // the keyframe gets through and normal service resumes
    expect(gate.pass(video(true), 100)).toBe(true);
    expect(gate.pass(video(false), 500)).toBe(true);
  });

  it('leaves room for a keyframe bigger than the budget so the frames after it are not dropped', () => {
    const gate = new VideoGate(1000, () => {});
    expect(gate.pass(video(true, 3000), 0)).toBe(true);
    // the keyframe is still draining: 3000 queued is over the budget, but within budget + keyframe
    expect(gate.pass(video(false), 3000)).toBe(true);
    expect(gate.pass(video(false), 4100)).toBe(false);
  });
});

describe('VideoGate.drain', () => {
  it('stops video for as long as the browser says it is behind, then resumes at a fresh keyframe', () => {
    let t = 0;
    const asks: number[] = [];
    const gate = new VideoGate(
      1000,
      () => asks.push(t),
      () => t,
    );
    // the gateway's own queue is empty, but the browser measured 400 ms of delay in buffers the gateway can't see
    gate.drain(400);
    expect(gate.pass(video(true), 0)).toBe(false);
    expect(gate.pass(audio, 0)).toBe(true);
    t = 399;
    expect(gate.pass(video(false), 0)).toBe(false);
    expect(asks).toEqual([]);
    // a second report of the same backlog while it drains changes nothing
    gate.drain(2000);
    t = 400;
    // drained: a keyframe is asked for, deltas wait for it
    expect(gate.pass(video(false), 0)).toBe(false);
    expect(asks).toEqual([400]);
    expect(gate.pass(video(true), 0)).toBe(true);
    expect(gate.pass(video(false), 0)).toBe(true);
  });

  it('caps one pause and ignores nonsense', () => {
    let t = 0;
    const gate = new VideoGate(
      1000,
      () => {},
      () => t,
    );
    gate.drain(-5);
    gate.drain(Number.NaN);
    expect(gate.pass(video(false), 0)).toBe(true);
    gate.drain(60_000);
    t = MAX_DRAIN_MS;
    expect(gate.pass(video(true), 0)).toBe(true);
  });
});

describe('gatewayMessage', () => {
  it('acts on gw- messages and keeps them from MoonlightWeb', () => {
    let t = 0;
    const gate = new VideoGate(
      1000,
      () => {},
      () => t,
    );
    expect(gatewayMessage(JSON.stringify({ type: 'gw-lag', ms: 500 }), gate)).toBe(true);
    expect(gate.pass(video(true), 0)).toBe(false);
    t = 500;
    expect(gate.pass(video(true), 0)).toBe(true);
    expect(gatewayMessage('{"type":"gw-hello"}', null)).toBe(true);
    expect(gatewayMessage('{"type":"gw-broken', gate)).toBe(true);
    expect(gatewayMessage(JSON.stringify({ type: 'keydown', keyCode: 65 }), gate)).toBe(false);
  });

  it('stamps clock notices with the time they are queued', () => {
    expect(JSON.parse(clockNotice(1234))).toEqual({ type: 'gw-clock', t: 1234 });
  });
});

describe('InputOrder', () => {
  afterEach(() => vi.useRealTimers());

  it('applies batches in sequence order', () => {
    const out: string[] = [];
    const order = new InputOrder((m) => out.push(...m));
    order.push(2, ['b']);
    order.push(3, ['c']);
    expect(out).toEqual([]);
    order.push(1, ['a']);
    expect(out).toEqual(['a', 'b', 'c']);
    order.close();
  });

  it("drops presses from a late batch so a key can't go down again after its own key-up", () => {
    vi.useFakeTimers();
    const out: string[] = [];
    const order = new InputOrder((m) => out.push(...m), 60);
    const down = JSON.stringify({ type: 'keydown', keyCode: 65 });
    const up = JSON.stringify({ type: 'keyup', keyCode: 65 });
    const beat = JSON.stringify({ type: 'inputstate', keys: [] });
    order.push(2, [up]);
    vi.advanceTimersByTime(60);
    order.push(1, [down, beat, JSON.stringify({ type: 'mouseup', button: 1 })]);
    expect(out).toEqual([up, JSON.stringify({ type: 'mouseup', button: 1 })]);
    order.close();
  });

  it('moves on without a missing batch after a short wait, and still applies it if it turns up', () => {
    vi.useFakeTimers();
    const out: string[] = [];
    const order = new InputOrder((m) => out.push(...m), 60);
    order.push(1, ['a']);
    order.push(3, ['c']);
    expect(out).toEqual(['a']);
    vi.advanceTimersByTime(60);
    expect(out).toEqual(['a', 'c']);
    order.push(2, ['late key-up']);
    expect(out).toEqual(['a', 'c', 'late key-up']);
    order.push(4, ['d']);
    expect(out).toEqual(['a', 'c', 'late key-up', 'd']);
    order.close();
  });

  it('applies unnumbered batches straight away', () => {
    const out: string[] = [];
    const order = new InputOrder((m) => out.push(...m));
    order.push(0, ['x']);
    expect(out).toEqual(['x']);
  });
});
