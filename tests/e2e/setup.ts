import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Application } from 'express';

/**
 * Shared e2e boot helpers. Each spec file runs against the shared better-sqlite3
 * `:memory:` database from `src/models/db/memory-db.ts` (vitest isolates files
 * by default) and must never import `@/server` or call `databaseService.init()`.
 *
 * Since the Drizzle + better-sqlite3 migration, the memory tables
 * (FuelStationsTable/LastUpdated/HistoricFuelStation) are seeded through the
 * model adapters (implemented with Drizzle `insert().values()` / `delete()`):
 * `init()` swaps in a fresh `:memory:` database and recreates the tables, so no
 * standalone sqlite instance is needed.
 */

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

export const closeTestServer = async (testServer: TestServer): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    testServer.server.close((err) => (err ? reject(err) : resolve()));
  });
};
