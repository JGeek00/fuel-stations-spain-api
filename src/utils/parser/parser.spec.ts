import { describe, it, expect } from 'vitest';
import { parseStringToFloat } from './parser';

describe('parseStringToFloat', () => {
  it('parses a simple decimal number (dot is stripped as thousands separator)', () => {
    // This function is designed for European format: dots = thousands, comma = decimal
    // So a dot in a standard decimal is stripped
    expect(parseStringToFloat('1234.56')).toBe(123456);
  });

  it('parses a standard decimal with no thousands separator', () => {
    expect(parseStringToFloat('100')).toBe(100);
  });

  it('parses European format with thousands dot and comma decimal', () => {
    expect(parseStringToFloat('1.234,56')).toBeCloseTo(1234.56);
  });

  it('parses a number with only thousands dot', () => {
    expect(parseStringToFloat('1.000')).toBe(1000);
  });

  it('parses a number with only comma decimal', () => {
    expect(parseStringToFloat('1234,5')).toBeCloseTo(1234.5);
  });

  it('parses an integer as a string', () => {
    expect(parseStringToFloat('42')).toBe(42);
  });

  it('returns null for undefined input', () => {
    expect(parseStringToFloat(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseStringToFloat('')).toBeNull();
  });

  it('handles a single comma', () => {
    expect(parseStringToFloat(',5')).toBeCloseTo(0.5);
  });

  it('handles multiple thousands dots', () => {
    expect(parseStringToFloat('1.000.000,00')).toBeCloseTo(1000000);
  });

  it('parses zero', () => {
    expect(parseStringToFloat('0')).toBe(0);
  });
});
