import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatCurrentDate } from '../datetime-formatter';

describe('formatCurrentDate', () => {
  const originalDate = globalThis.Date;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // restore the original Date constructor
    // use globalThis to satisfy TypeScript's globals
    (globalThis as any).Date = originalDate;
  });

  it('returns a string in YYYY-MM-DD HH:MM:SS format', () => {
    vi.setSystemTime(new Date('2024-03-15T14:30:45'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-03-15 14:30:45');
  });

  it('pads single-digit months with leading zero', () => {
    vi.setSystemTime(new Date('2024-01-20T10:05:03'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-01-20 10:05:03');
  });

  it('pads single-digit days with leading zero', () => {
    vi.setSystemTime(new Date('2024-12-05T09:00:00'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-12-05 09:00:00');
  });

  it('pads single-digit hours with leading zero', () => {
    vi.setSystemTime(new Date('2024-06-15T08:30:00'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-06-15 08:30:00');
  });

  it('pads single-digit minutes with leading zero', () => {
    vi.setSystemTime(new Date('2024-06-15T12:05:30'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-06-15 12:05:30');
  });

  it('pads single-digit seconds with leading zero', () => {
    vi.setSystemTime(new Date('2024-06-15T12:30:05'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-06-15 12:30:05');
  });

  it('handles midnight correctly', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-01-01 00:00:00');
  });

  it('handles end of day correctly', () => {
    vi.setSystemTime(new Date('2024-12-31T23:59:59'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-12-31 23:59:59');
  });

  it('returns double-digit year correctly', () => {
    vi.setSystemTime(new Date('2024-11-25T16:45:30'));

    const result = formatCurrentDate();

    expect(result).toBe('2024-11-25 16:45:30');
  });
});
