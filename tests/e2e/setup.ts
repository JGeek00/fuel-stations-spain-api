import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Application } from 'express';

/**
 * Shared e2e boot helpers. Each spec file runs against the shared better-sqlite3
 * `:memory:` database from `src/models/db/memory-db.ts` (vitest isolates files
 * by default) and must never import `@/server` or call `databaseService.init()`.
 *
 * Since the layered-architecture refactor, seeds reset the schema with
 * `ensureMemorySchema()` (infrastructure) and write through direct Drizzle
 * `insert().values()` / `delete()` over the memory tables plus the
 * repositories: no adapter layer exists anymore.
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
