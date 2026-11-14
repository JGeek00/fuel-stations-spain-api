import { describe, it, expect, vi } from 'vitest';
import migration001 from '@/infrastructure/migrations/001_baseline';
import migration002 from '@/infrastructure/migrations/002_unique_station_date';
import migration003 from '@/infrastructure/migrations/003_ensure_historic_schema';
import { MIGRATIONS } from '@/infrastructure/migrations';

/**
 * Migration up/down runners against a mock db handle ({ execute: vi.fn() }).
 * 003.up intentionally calls the real ensurePersistedSchema, which works
 * against the mock because it only issues `db.execute` statements.
 */

const createMockDb = () => ({
  execute: vi.fn().mockResolvedValue({ rows: [] }),
});

describe('001_baseline', () => {
  it('exposes version and name metadata', () => {
    expect(migration001.version).toBe('001');
    expect(migration001.name).toBe('baseline');
  });

  it('up renames every historic_data column from snake_case to camelCase', async () => {
    const db = createMockDb();

    await migration001.up(db as never);

    expect(db.execute).toHaveBeenCalledTimes(25);
    const firstCall = db.execute.mock.calls[0][0];
    // sql`` template objects carry their chunks; serialize for the assertion.
    const serialized = JSON.stringify(firstCall);
    expect(serialized).toContain('station_id');
    expect(serialized).toContain('stationId');
  });

  it('down renames every column back from camelCase to snake_case (reversed order)', async () => {
    const db = createMockDb();

    await migration001.down(db as never);

    expect(db.execute).toHaveBeenCalledTimes(25);
    const serialized = JSON.stringify(db.execute.mock.calls[0][0]);
    // Reversed: methanol_price is renamed first.
    expect(serialized).toContain('methanol_price');
    expect(serialized).toContain('methanolPrice');
  });
});

describe('002_unique_station_date', () => {
  it('exposes version and name metadata', () => {
    expect(migration002.version).toBe('002');
    expect(migration002.name).toBe('unique_station_date');
  });

  it('up creates the unique index and the historic_no_data table', async () => {
    const db = createMockDb();

    await migration002.up(db as never);

    expect(db.execute).toHaveBeenCalledTimes(2);
    const calls = db.execute.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls[0]).toContain('idx_historic_station_date');
    expect(calls[0]).toContain('historic_data');
    expect(calls[1]).toContain('historic_no_data');
  });

  it('down drops the historic_no_data table and the unique index', async () => {
    const db = createMockDb();

    await migration002.down(db as never);

    expect(db.execute).toHaveBeenCalledTimes(2);
    const calls = db.execute.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls[0]).toContain('DROP TABLE');
    expect(calls[0]).toContain('historic_no_data');
    expect(calls[1]).toContain('DROP INDEX');
    expect(calls[1]).toContain('idx_historic_station_date');
  });
});

describe('003_ensure_historic_schema', () => {
  it('exposes version and name metadata', () => {
    expect(migration003.version).toBe('003');
    expect(migration003.name).toBe('ensure_historic_schema');
  });

  it('up calls the real ensurePersistedSchema against the db handle', async () => {
    const db = createMockDb();

    await migration003.up(db as never);

    // CREATE TABLE historic_data + CREATE UNIQUE INDEX + CREATE TABLE historic_no_data
    expect(db.execute).toHaveBeenCalledTimes(3);
    const calls = db.execute.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls[0]).toContain('CREATE TABLE IF NOT EXISTS historic_data');
    expect(calls[1]).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_historic_station_date');
    expect(calls[2]).toContain('CREATE TABLE IF NOT EXISTS historic_no_data');
  });

  it('down drops the no-data table and the unique index', async () => {
    const db = createMockDb();

    await migration003.down(db as never);

    expect(db.execute).toHaveBeenCalledTimes(2);
    const calls = db.execute.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls[0]).toContain('DROP TABLE IF EXISTS historic_no_data');
    expect(calls[1]).toContain('DROP INDEX IF EXISTS idx_historic_station_date');
  });
});

describe('MIGRATIONS registry', () => {
  it('lists the three migrations in order', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(['001', '002', '003']);
    expect(MIGRATIONS.map((m) => m.name)).toEqual(['baseline', 'unique_station_date', 'ensure_historic_schema']);
  });

  it('registry entries are the same objects as the migration modules', () => {
    expect(MIGRATIONS[0]).toBe(migration001);
    expect(MIGRATIONS[1]).toBe(migration002);
    expect(MIGRATIONS[2]).toBe(migration003);
  });
});
