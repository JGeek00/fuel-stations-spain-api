import { describe, it, expect } from 'vitest';
import { twoDigits } from '../numbers';

describe('twoDigits', () => {
  it('pads single-digit numbers with leading zero', () => {
    expect(twoDigits(0)).toBe('00');
    expect(twoDigits(1)).toBe('01');
    expect(twoDigits(5)).toBe('05');
    expect(twoDigits(9)).toBe('09');
  });

  it('leaves two-digit numbers unchanged', () => {
    expect(twoDigits(10)).toBe('10');
    expect(twoDigits(42)).toBe('42');
    expect(twoDigits(99)).toBe('99');
  });

  it('returns multi-digit numbers as-is', () => {
    expect(twoDigits(100)).toBe('100');
    expect(twoDigits(1234)).toBe('1234');
  });

  it('handles decimal numbers (pads integer part to 2 digits)', () => {
    expect(twoDigits(0.5)).toBe('00.5');
    expect(twoDigits(1.23)).toBe('01.23');
  });

  it('returns a string', () => {
    expect(typeof twoDigits(5)).toBe('string');
  });
});
