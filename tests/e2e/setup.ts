import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { Sequelize } from 'sequelize';

/**
 * Shared e2e boot helpers. Each spec file owns its own in-memory SQLite instance
 * (vitest isolates files by default) and must never import `@/server` or call
 * `databaseService.init()`.
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
