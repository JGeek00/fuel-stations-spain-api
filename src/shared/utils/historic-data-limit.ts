const MIN_MONTHS = 6;

import { logger } from './logger';

/**
 * Cached parsed result. `undefined` means not yet parsed; `null` means no limit.
 */
let cachedResult: number | null | undefined = undefined;

/**
 * Parses a raw string in the format `XyXm`, `Xy`, or `Xm` into total months.
 * Returns `null` if the format is invalid.
 *
 * Examples: "4y6m" → 54, "1y" → 12, "6m" → 6
 */
export function parseHistoricDataMaxRange(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // XyXm (e.g., "4y6m")
  let match = trimmed.match(/^(\d+)y(\d+)m$/);
  if (match) {
    const years = parseInt(match[1], 10);
    const months = parseInt(match[2], 10);
    return years * 12 + months;
  }

  // Xy only (e.g., "1y")
  match = trimmed.match(/^(\d+)y$/);
  if (match) {
    const years = parseInt(match[1], 10);
    return years * 12;
  }

  // Xm only (e.g., "6m")
  match = trimmed.match(/^(\d+)m$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Reads and parses `HISTORIC_DATA_MAX_RANGE` from the environment.
 * Result is cached after the first call so parsing only happens once.
 *
 * - Not set or empty → `null` (no limit)
 * - Valid but < MIN_MONTHS → clamped to MIN_MONTHS
 * - Invalid format → `null` (no limit), warning was already logged at startup
 */
export function getHistoricDataMaxRangeMonths(): number | null {
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const raw = process.env.HISTORIC_DATA_MAX_RANGE;
  if (!raw || raw.trim() === '') {
    cachedResult = null;
    return null;
  }

  const months = parseHistoricDataMaxRange(raw);
  if (months === null) {
    // Invalid format — startup validation already warned.
    cachedResult = null;
    return null;
  }

  if (months < MIN_MONTHS) {
    cachedResult = MIN_MONTHS;
    return MIN_MONTHS;
  }

  cachedResult = months;
  return months;
}

/**
 * Formats a month count into a human-readable string for error messages.
 * Examples: 6 → "6 months", 12 → "1 year", 18 → "1 year and 6 months", 54 → "4 years and 6 months"
 */
export function formatRange(months: number): string {
  const years = Math.floor(months / 12);
  const remainder = months % 12;

  if (years > 0 && remainder > 0) {
    return `${years} year${years > 1 ? 's' : ''} and ${remainder} month${remainder > 1 ? 's' : ''}`;
  }
  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${remainder} month${remainder > 1 ? 's' : ''}`;
}

/**
 * Validates the `HISTORIC_DATA_MAX_RANGE` environment variable at server startup.
 * Logs a warning if the format is invalid.
 *
 * Returns an object describing the outcome for the step log:
 * - status: '✓' | '⚠'
 * - detail: human-readable detail string
 */
export function validateHistoricDataMaxRange(): { status: '✓' | '⚠'; detail: string } {
  const raw = process.env.HISTORIC_DATA_MAX_RANGE;

  if (!raw || raw.trim() === '') {
    return { status: '⚠', detail: 'not set — no limit' };
  }

  const months = parseHistoricDataMaxRange(raw);
  if (months === null) {
    logger.warn(`  ✗ Invalid HISTORIC_DATA_MAX_RANGE value: "${raw}". Expected format: XyXm (e.g., "4y6m", "1y", "6m"). Defaulting to no limit.`);
    return { status: '⚠', detail: `invalid format ("${raw}") — no limit` };
  }

  const effective = Math.max(months, MIN_MONTHS);
  if (months < MIN_MONTHS) {
    logger.warn(`  ✗ HISTORIC_DATA_MAX_RANGE "${raw}" is less than ${MIN_MONTHS} months. Minimum of ${MIN_MONTHS} months will be applied.`);
  }

  return { status: '✓', detail: formatRange(effective) };
}
