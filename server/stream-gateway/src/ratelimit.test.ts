import { describe, expect, it } from 'vitest';
import { GLOBAL, LoginLimiter, PER_IP, WINDOW_MS, clientIp } from './ratelimit.js';

describe('LoginLimiter', () => {
  it('locks one address out after five failures, for fifteen minutes', () => {
    const l = new LoginLimiter();
    for (let i = 0; i < PER_IP - 1; i++) l.fail('1.1.1.1', 0);
    expect(l.wait('1.1.1.1', 0)).toBe(0);
    l.fail('1.1.1.1', 0);
    expect(l.wait('1.1.1.1', 1000)).toBe(WINDOW_MS - 1000);
    expect(l.wait('2.2.2.2', 1000)).toBe(0);
    expect(l.wait('1.1.1.1', WINDOW_MS)).toBe(0);
  });

  it('forgets failures older than the window and after a success', () => {
    const l = new LoginLimiter();
    for (let i = 0; i < PER_IP - 1; i++) l.fail('1.1.1.1', 0);
    l.fail('1.1.1.1', WINDOW_MS + 1);
    expect(l.wait('1.1.1.1', WINDOW_MS + 1)).toBe(0);
    for (let i = 0; i < PER_IP - 1; i++) l.fail('3.3.3.3', 0);
    l.succeed('3.3.3.3');
    l.fail('3.3.3.3', 0);
    expect(l.wait('3.3.3.3', 0)).toBe(0);
  });

  it('locks everyone out when failures come from many addresses', () => {
    const l = new LoginLimiter();
    for (let i = 0; i < GLOBAL; i++) l.fail(`10.0.0.${i}`, 0);
    expect(l.wait('9.9.9.9', 0)).toBe(WINDOW_MS);
  });
});

describe('clientIp', () => {
  it('trusts exactly one proxy hop', () => {
    expect(clientIp('6.6.6.6, 1.2.3.4', '172.18.0.2')).toBe('1.2.3.4');
    expect(clientIp(undefined, '::ffff:172.18.0.2')).toBe('172.18.0.2');
    expect(clientIp('', undefined)).toBe('unknown');
  });
});
