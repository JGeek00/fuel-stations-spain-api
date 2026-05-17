import { describe, it, expect } from 'vitest';
import { sleep } from '@/utils/sleep';

describe('sleep', () => {
  it('returns a Promise', () => {
    const result = sleep(0);
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves after the specified duration', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(150);
  });

  it('resolves with undefined', async () => {
    const result = await sleep(0);
    expect(result).toBeUndefined();
  });

  it('handles zero milliseconds', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
