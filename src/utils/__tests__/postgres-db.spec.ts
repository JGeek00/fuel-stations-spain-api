/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validatePostgresDbData } from '../postgres-db';

describe('validatePostgresDbData', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all postgres env vars before each test
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_DATABASE;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('returns true when all required env vars are set', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_USER = 'user';
    process.env.POSTGRES_PASSWORD = 'pass';
    process.env.POSTGRES_DATABASE = 'db';

    expect(validatePostgresDbData()).toBe(true);
  });

  it('returns false when POSTGRES_HOST is missing', () => {
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_USER = 'user';
    process.env.POSTGRES_PASSWORD = 'pass';
    process.env.POSTGRES_DATABASE = 'db';

    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when POSTGRES_PORT is missing', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_USER = 'user';
    process.env.POSTGRES_PASSWORD = 'pass';
    process.env.POSTGRES_DATABASE = 'db';

    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when POSTGRES_USER is missing', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_PASSWORD = 'pass';
    process.env.POSTGRES_DATABASE = 'db';

    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when POSTGRES_PASSWORD is missing', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_USER = 'user';
    process.env.POSTGRES_DATABASE = 'db';

    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when POSTGRES_DATABASE is missing', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_USER = 'user';
    process.env.POSTGRES_PASSWORD = 'pass';

    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when no env vars are set', () => {
    expect(validatePostgresDbData()).toBe(false);
  });

  it('returns false when only some env vars are set', () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';

    expect(validatePostgresDbData()).toBe(false);
  });
});
