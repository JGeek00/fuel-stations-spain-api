import { describe, it, expect } from 'vitest';
import { parseSessionId, parseCsvEnv } from '@/utils/mcp';

describe('parseSessionId', () => {
  it('returns the ID for a valid string', () => {
    expect(parseSessionId('abc-123')).toBe('abc-123');
    expect(parseSessionId('some-long-session-id')).toBe('some-long-session-id');
  });

  it('returns undefined for undefined input', () => {
    expect(parseSessionId(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseSessionId('')).toBeUndefined();
  });

  it('returns undefined for "null" string literal', () => {
    expect(parseSessionId('null')).toBeUndefined();
  });

  it('returns undefined for "undefined" string literal', () => {
    expect(parseSessionId('undefined')).toBeUndefined();
  });
});

describe('parseCsvEnv', () => {
  it('returns empty array for undefined', () => {
    expect(parseCsvEnv(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsvEnv('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseCsvEnv('   ')).toEqual([]);
  });

  it('splits comma-separated values', () => {
    expect(parseCsvEnv('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace around values', () => {
    expect(parseCsvEnv(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty segments', () => {
    expect(parseCsvEnv('a,,b')).toEqual(['a', 'b']);
    expect(parseCsvEnv(',a,b,')).toEqual(['a', 'b']);
  });

  it('handles single value', () => {
    expect(parseCsvEnv('only-one')).toEqual(['only-one']);
  });

  it('handles IPv4 addresses', () => {
    expect(parseCsvEnv('192.168.1.1,10.0.0.1')).toEqual(['192.168.1.1', '10.0.0.1']);
  });
});
