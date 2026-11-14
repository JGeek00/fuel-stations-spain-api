import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Op } from 'sequelize';
import { and, asc, between, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Shared better-sqlite3 `:memory:` database behind the FuelStations/LastUpdated
 * Drizzle tables. A fresh `:memory:` database is swapped in on every model
 * `init()` call, restoring the per-instance isolation Sequelize gave tests
 * (fresh `new Sequelize({ storage: ':memory:' })` per setup).
 */
export const memorySqlite: BetterSqlite3.Database = new Database(':memory:');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memoryDb = drizzle(memorySqlite) as any;

let active = { sqlite: memorySqlite as BetterSqlite3.Database, db: memoryDb };

export const getMemorySqlite = (): BetterSqlite3.Database => active.sqlite;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getMemoryDb = (): any => active.db;

export const resetMemoryDb = (): void => {
  const sqlite = new Database(':memory:');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active = { sqlite, db: drizzle(sqlite) as any };
};

export type MemoryTable = Record<string, AnySQLiteColumn>;

/**
 * Minimal Sequelize model-instance lookalike returned by the memory DB
 * adapters: consumers only use `dataValues`, `get({ plain: true })` and
 * `getDataValue(key)`.
 */
export class MemoryRow<T extends Record<string, unknown>> {
  dataValues: T;

  constructor(values: T) {
    this.dataValues = values;
  }

  get(_options?: { plain?: boolean }): T {
    return { ...this.dataValues };
  }

  getDataValue<K extends keyof T>(key: K): T[K] {
    return this.dataValues[key];
  }
}

type SequelizeStyleWhere = Record<string, unknown>;

/** Translate a Sequelize-style where object ({col, [Op.between], [Op.in]}) into Drizzle conditions. */
export function translateWhere(table: MemoryTable, where?: SequelizeStyleWhere): SQL | undefined {
  if (!where) return undefined;

  const conditions: SQL[] = [];
  for (const [key, value] of Object.entries(where)) {
    const column = table[key];
    if (!column) {
      throw new Error(`Unknown column "${key}" in memory DB query`);
    }
    const record = value as Record<symbol, unknown>;
    if (Array.isArray(value)) {
      conditions.push(inArray(column, value));
    } else if (value !== null && typeof value === 'object' && Op.between in record) {
      const [min, max] = record[Op.between] as [unknown, unknown];
      conditions.push(between(column, min as never, max as never));
    } else if (value !== null && typeof value === 'object' && Op.in in record) {
      conditions.push(inArray(column, record[Op.in] as never));
    } else if (value !== null && typeof value === 'object' && Op.eq in record) {
      conditions.push(eq(column, record[Op.eq] as never));
    } else if (value !== null && typeof value === 'object') {
      throw new Error(`Unsupported memory DB where operator for column "${key}"`);
    } else {
      conditions.push(eq(column, value as never));
    }
  }

  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

/** Translate a Sequelize-style order ([col, 'ASC'|'DESC']) into Drizzle orderBy entries. */
export function translateOrder(table: MemoryTable, order?: unknown[][]): SQL[] {
  if (!order) return [];
  return order.map(([column, direction]) => {
    const col = table[column as string];
    if (!col) {
      throw new Error(`Unknown order column "${String(column)}" in memory DB query`);
    }
    return String(direction).toUpperCase() === 'DESC' ? desc(col) : asc(col);
  });
}
