import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let parseHistoricDataMaxRange: typeof import('./historic-data-limit').parseHistoricDataMaxRange;
let formatRange: typeof import('./historic-data-limit').formatRange;
let getHistoricDataMaxRangeMonths: typeof import('./historic-data-limit').getHistoricDataMaxRangeMonths;
let validateHistoricDataMaxRange: typeof import('./historic-data-limit').validateHistoricDataMaxRange;

describe('parseHistoricDataMaxRange', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./historic-data-limit');
    parseHistoricDataMaxRange = mod.parseHistoricDataMaxRange;
    formatRange = mod.formatRange;
    getHistoricDataMaxRangeMonths = mod.getHistoricDataMaxRangeMonths;
    validateHistoricDataMaxRange = mod.validateHistoricDataMaxRange;
  });

  it('parses XyXm format', () => {
    expect(parseHistoricDataMaxRange('4y6m')).toBe(54);
  });

  it('parses Xy format', () => {
    expect(parseHistoricDataMaxRange('1y')).toBe(12);
    expect(parseHistoricDataMaxRange('2y')).toBe(24);
    expect(parseHistoricDataMaxRange('10y')).toBe(120);
  });

  it('parses Xm format', () => {
    expect(parseHistoricDataMaxRange('6m')).toBe(6);
    expect(parseHistoricDataMaxRange('12m')).toBe(12);
    expect(parseHistoricDataMaxRange('36m')).toBe(36);
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseHistoricDataMaxRange('  4y6m  ')).toBe(54);
    expect(parseHistoricDataMaxRange('  1y  ')).toBe(12);
    expect(parseHistoricDataMaxRange('  6m  ')).toBe(6);
  });

  it('returns null for empty string', () => {
    expect(parseHistoricDataMaxRange('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseHistoricDataMaxRange('   ')).toBeNull();
  });

  it('returns null for invalid formats', () => {
    expect(parseHistoricDataMaxRange('abc')).toBeNull();
    expect(parseHistoricDataMaxRange('y4m6')).toBeNull();
    expect(parseHistoricDataMaxRange('4y6')).toBeNull();
    expect(parseHistoricDataMaxRange('y4')).toBeNull();
    expect(parseHistoricDataMaxRange('6m0')).toBeNull();
    expect(parseHistoricDataMaxRange('4y6m1')).toBeNull();
  });
});

describe('formatRange', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./historic-data-limit');
    formatRange = mod.formatRange;
  });

  it('formats less than a year', () => {
    expect(formatRange(1)).toBe('1 month');
    expect(formatRange(6)).toBe('6 months');
    expect(formatRange(11)).toBe('11 months');
  });

  it('formats exactly one year', () => {
    expect(formatRange(12)).toBe('1 year');
  });

  it('formats multiple years', () => {
    expect(formatRange(24)).toBe('2 years');
    expect(formatRange(36)).toBe('3 years');
    expect(formatRange(120)).toBe('10 years');
  });

  it('formats years and months combined', () => {
    expect(formatRange(13)).toBe('1 year and 1 month');
    expect(formatRange(18)).toBe('1 year and 6 months');
    expect(formatRange(54)).toBe('4 years and 6 months');
    expect(formatRange(25)).toBe('2 years and 1 month');
  });

  it('handles zero months', () => {
    expect(formatRange(0)).toBe('0 month');
  });
});

describe('getHistoricDataMaxRangeMonths', () => {
  const originalEnv = process.env.HISTORIC_DATA_MAX_RANGE;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const mod = await import('./historic-data-limit');
    getHistoricDataMaxRangeMonths = mod.getHistoricDataMaxRangeMonths;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.HISTORIC_DATA_MAX_RANGE = originalEnv;
  });

  it('returns null when env var is not set', async () => {
    delete process.env.HISTORIC_DATA_MAX_RANGE;
    // Force fresh module load
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBeNull();
  });

  it('returns null when env var is empty', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBeNull();
  });

  it('returns null when env var is whitespace', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '   ';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBeNull();
  });

  it('returns parsed months for valid value', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '4y6m';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBe(54);
  });

  it('returns parsed months for Xy format', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '1y';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBe(12);
  });

  it('returns parsed months for Xm format', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '6m';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBe(6);
  });

  it('clamps to MIN_MONTHS when value is below minimum', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '3m';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBe(6);
  });

  it('returns null for invalid format', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = 'invalid';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    expect(mod.getHistoricDataMaxRangeMonths()).toBeNull();
  });

  it('caches result after first call', async () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '2y';
    const mod = await import('./historic-data-limit?v=' + Date.now());
    const first = mod.getHistoricDataMaxRangeMonths();
    const second = mod.getHistoricDataMaxRangeMonths();
    expect(first).toBe(24);
    expect(second).toBe(24);
  });
});

describe('validateHistoricDataMaxRange', () => {
  const originalEnv = process.env.HISTORIC_DATA_MAX_RANGE;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const mod = await import('./historic-data-limit');
    validateHistoricDataMaxRange = mod.validateHistoricDataMaxRange;
    formatRange = mod.formatRange;
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    process.env.HISTORIC_DATA_MAX_RANGE = originalEnv;
  });

  it('returns warning when env var is not set', () => {
    delete process.env.HISTORIC_DATA_MAX_RANGE;
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '⚠', detail: 'not set — no limit' });
  });

  it('returns warning when env var is empty', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '⚠', detail: 'not set — no limit' });
  });

  it('returns success for valid format', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '4y6m';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '✓', detail: '4 years and 6 months' });
  });

  it('returns success for Xy format', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '2y';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '✓', detail: '2 years' });
  });

  it('returns success for Xm format', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '12m';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '✓', detail: '1 year' });
  });

  it('returns warning for invalid format', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = 'invalid';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '⚠', detail: 'invalid format ("invalid") — no limit' });
  });

  it('clamps to MIN_MONTHS when value is below minimum', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '3m';
    const result = validateHistoricDataMaxRange();
    expect(result).toEqual({ status: '✓', detail: '6 months' });
  });

  it('logs warning for invalid format', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = 'bad';
    validateHistoricDataMaxRange();

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('Invalid HISTORIC_DATA_MAX_RANGE value');
  });

  it('logs warning when value is below minimum', () => {
    process.env.HISTORIC_DATA_MAX_RANGE = '2m';
    validateHistoricDataMaxRange();

    const output = stdoutWrite.mock.calls[0][0];
    expect(output).toContain('less than 6 months');
  });
});
