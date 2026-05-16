import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from './logger';

describe('LogLevel enum', () => {
  it('has correct numeric values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });
});

describe('logger', () => {
  const originalEnv = { ...process.env };
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    process.env = originalEnv;
  });

  it('logs info message with [INFO] label', () => {
    logger.info('test message');

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('[INFO]');
    expect(output).toContain('test message');
  });

  it('logs warn message with [WARN] label', () => {
    logger.warn('warning message');

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('[WARN]');
    expect(output).toContain('warning message');
  });

  it('logs error message with [ERROR] label', () => {
    logger.error('error message');

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('[ERROR]');
    expect(output).toContain('error message');
  });

  it('formats Error instances with message and stack', () => {
    const err = new Error('something went wrong');
    logger.error(err);

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('something went wrong');
  });

  it('joins multiple arguments with spaces', () => {
    logger.info('arg1', 'arg2', 42);

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('arg1 arg2 42');
  });

  it('banner always writes regardless of level', () => {
    logger.banner('startup banner');

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toBe('startup banner\n');
  });

  it('output contains ISO timestamp', () => {
    logger.info('test');

    const output = stdoutWrite.mock.calls[0][0];
    // ISO timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
