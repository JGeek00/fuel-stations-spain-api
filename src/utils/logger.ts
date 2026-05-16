/**
 * Lightweight logging utility with level filtering.
 *
 * Levels (ascending severity): DEBUG < INFO < WARN < ERROR
 *
 * Configuration via environment variables:
 *   LOG_LEVEL  — "debug" | "info" | "warn" | "error" (default: "info")
 *   LOG_FORMAT — "text" | "json" (default: "text")
 *
 * Banner messages (logger.banner) bypass the level filter and are
 * always written so that startup/version output is never hidden.
 */

// ─── Level enum ──────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

// ─── ANSI colours ────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.cyan,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
};

// ─── Config ──────────────────────────────────────────────────────────────────

const RAW_LEVEL = (process.env.LOG_LEVEL ?? 'info').toLowerCase();

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const currentLevel: LogLevel = LEVEL_MAP[RAW_LEVEL] ?? LogLevel.INFO;

const useJson = process.env.LOG_FORMAT === 'json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timestamp(): string {
  return new Date().toISOString();
}

function formatArgs(...args: unknown[]): string {
  return args
    .map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack ?? ''}` : String(arg)))
    .join(' ');
}

function shouldLog(level: LogLevel): boolean {
  return level >= currentLevel;
}

// ─── Output ──────────────────────────────────────────────────────────────────

function logText(level: LogLevel, message: string): void {
  const ts = timestamp();
  const label = LEVEL_LABELS[level];
  const color = LEVEL_COLORS[level];
  // [ISO-8601] [LEVEL] message
  process.stdout.write(`${COLORS.dim}${ts}${COLORS.reset} ${color}${COLORS.bold}[${label}]${COLORS.reset} ${message}\n`);
}

function logJson(level: LogLevel, message: string): void {
  const entry = {
    timestamp: timestamp(),
    level: LEVEL_LABELS[level],
    message,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function write(level: LogLevel, message: string): void {
  if (useJson) {
    logJson(level, message);
  } else {
    logText(level, message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog(LogLevel.DEBUG)) write(LogLevel.DEBUG, formatArgs(...args));
  },

  info: (...args: unknown[]) => {
    if (shouldLog(LogLevel.INFO)) write(LogLevel.INFO, formatArgs(...args));
  },

  warn: (...args: unknown[]) => {
    if (shouldLog(LogLevel.WARN)) write(LogLevel.WARN, formatArgs(...args));
  },

  error: (...args: unknown[]) => {
    if (shouldLog(LogLevel.ERROR)) write(LogLevel.ERROR, formatArgs(...args));
  },

  /**
   * Banner message — always written regardless of LOG_LEVEL.
   * Used for startup/version boxes that must never be suppressed.
   */
  banner: (message: string): void => {
    if (useJson) {
      logJson(LogLevel.INFO, message);
    } else {
      process.stdout.write(message + '\n');
    }
  },
};
