import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { Sequelize } from 'sequelize';

/**
 * Shared e2e boot helpers. Each spec file owns its own in-memory SQLite instance
 * (vitest isolates files by default) and must never import `@/server` or call
 * `databaseService.init()`.
 *
 * Since the Drizzle + better-sqlite3 migration, the memory tables
 * (FuelStationsTable/LastUpdated) live in the shared better-sqlite3 `:memory:`
 * database from `src/models/db/memory-db.ts`; seeding goes through the model
 * adapters (implemented with Drizzle `insert().values()` / `delete()`), so the
 * instance returned here is only needed while the historic tables are still on
 * Sequelize (historic-prices spec inits HistoricFuelStation on it).
 */

export const createSqlite = (): Sequelize =>
  new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

export interface TestServer {
  server: Server;
  baseUrl: string;
}

export const listenApp = async (app: Application): Promise<TestServer> => {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
};

export const closeTestServer = async (testServer: TestServer, sequelize?: Sequelize): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    testServer.server.close((err) => (err ? reject(err) : resolve()));
  });
  if (sequelize) {
    await sequelize.close();
  }
};
