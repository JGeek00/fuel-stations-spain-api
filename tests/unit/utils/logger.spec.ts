import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from '@/shared/utils/logger';

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

  it('filters debug messages at the default level', () => {
    logger.debug('hidden debug message');

    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('formats an Error without a stack (stack fallback)', () => {
    const err = new Error('no stack');
    err.stack = undefined;

    logger.error(err);

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('no stack');
  });
});

// ── Env-dependent logger configurations (fresh module per import) ──────────

describe('logger with LOG_FORMAT=json', () => {
  const originalEnv = { ...process.env };
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.LOG_FORMAT = 'json';
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  it('writes JSON entries', async () => {
    const { logger } = await import('@/shared/utils/logger');
    logger.info('json message');

    const output = stdoutWrite.mock.calls[0][0];
    const entry = JSON.parse(output);
    expect(entry.level).toBe('INFO');
    expect(entry.message).toBe('json message');
    expect(entry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('banner writes JSON too', async () => {
    const { logger } = await import('@/shared/utils/logger');
    logger.banner('json banner');

    const entry = JSON.parse(stdoutWrite.mock.calls[0][0]);
    expect(entry.level).toBe('INFO');
    expect(entry.message).toBe('json banner');
  });
});

describe('logger with LOG_LEVEL filtering', () => {
  const originalEnv = { ...process.env };
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    // Keep text formatting; each test sets only its own LOG_LEVEL.
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_LEVEL;
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  it('shows debug messages when LOG_LEVEL=debug', async () => {
    process.env.LOG_LEVEL = 'debug';
    const { logger } = await import('@/shared/utils/logger');
    logger.debug('verbose detail');

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('verbose detail');
  });

  it('filters info messages when LOG_LEVEL=warn', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { logger } = await import('@/shared/utils/logger');
    logger.info('should be filtered');

    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('filters warn messages when LOG_LEVEL=error', async () => {
    process.env.LOG_LEVEL = 'error';
    const { logger } = await import('@/shared/utils/logger');
    logger.warn('should be filtered');

    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('falls back to info for an unknown LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'bogus-level';
    const { logger } = await import('@/shared/utils/logger');
    logger.debug('filtered at info level');

    expect(stdoutWrite).not.toHaveBeenCalled();

    logger.info('info still visible');
    expect(stdoutWrite).toHaveBeenCalledTimes(1);
  });
});
