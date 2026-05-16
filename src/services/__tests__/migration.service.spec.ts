import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sequelize } from 'sequelize';

// Mock logger
vi.mock('@/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Migrations model
const mockMigrationsCreate = vi.fn();
const mockMigrationsDestroy = vi.fn();
const mockMigrationsFindAll = vi.fn();
vi.mock('@/models/db/Migrations', () => ({
  Migrations: {
    create: mockMigrationsCreate,
    destroy: mockMigrationsDestroy,
    findAll: mockMigrationsFindAll,
  },
  MigrationsAttributes: {},
}));

// Mock MIGRATIONS
const mockMigration001 = {
  version: '001',
  name: 'baseline',
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
};
const mockMigration002 = {
  version: '002',
  name: 'unique_station_date',
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/migrations', () => ({
  MIGRATIONS: [mockMigration001, mockMigration002],
}));

describe('MigrationService', () => {
  let mockSequelize: Sequelize;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSequelize = new Sequelize('sqlite::memory:', { logging: false });
    mockSequelize.transaction = vi.fn().mockImplementation(async (callback) => {
      const mockTransaction = { id: 'mock-tx' };
      return callback(mockTransaction);
    });
    mockSequelize.query = vi.fn().mockResolvedValue([[]]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('run', () => {
    it('applies pending migrations', async () => {
      mockMigrationsFindAll.mockResolvedValue([]);

      const { migrationService } = await import('../migration.service');
      await migrationService.run(mockSequelize);

      expect(mockMigration001.up).toHaveBeenCalledWith(mockSequelize);
      expect(mockMigration002.up).toHaveBeenCalledWith(mockSequelize);
      expect(mockMigrationsCreate).toHaveBeenCalledTimes(2);
    });

    it('skips already applied migrations', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
      ]);

      const { migrationService } = await import('../migration.service');
      await migrationService.run(mockSequelize);

      expect(mockMigration001.up).not.toHaveBeenCalled();
      expect(mockMigration002.up).toHaveBeenCalledWith(mockSequelize);
      expect(mockMigrationsCreate).toHaveBeenCalledTimes(1);
    });

    it('does nothing when all migrations are applied', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
        { version: '002' },
      ]);

      const { migrationService } = await import('../migration.service');
      await migrationService.run(mockSequelize);

      expect(mockMigration001.up).not.toHaveBeenCalled();
      expect(mockMigration002.up).not.toHaveBeenCalled();
      expect(mockMigrationsCreate).not.toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('rolls back the last migration', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
        { version: '002' },
      ]);

      const { migrationService } = await import('../migration.service');
      await migrationService.rollback(mockSequelize, 1);

      expect(mockMigration002.down).toHaveBeenCalledWith(mockSequelize);
      expect(mockMigrationsDestroy).toHaveBeenCalledWith({
        where: { version: '002' },
        transaction: expect.any(Object),
        logging: false,
      });
    });

    it('rolls back multiple migrations', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
        { version: '002' },
      ]);

      const { migrationService } = await import('../migration.service');
      await migrationService.rollback(mockSequelize, 2);

      expect(mockMigration002.down).toHaveBeenCalled();
      expect(mockMigration001.down).toHaveBeenCalled();
      expect(mockMigrationsDestroy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no migrations to rollback', async () => {
      mockMigrationsFindAll.mockResolvedValue([]);

      const { migrationService } = await import('../migration.service');
      await migrationService.rollback(mockSequelize, 1);

      expect(mockMigration001.down).not.toHaveBeenCalled();
      expect(mockMigration002.down).not.toHaveBeenCalled();
      expect(mockMigrationsDestroy).not.toHaveBeenCalled();
    });

    it('skips migrations not found in registry', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '999' },
      ]);

      const { migrationService } = await import('../migration.service');
      await migrationService.rollback(mockSequelize, 1);

      expect(mockMigrationsDestroy).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('returns status for all migrations', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
      ]);

      const { migrationService } = await import('../migration.service');
      const status = await migrationService.status(mockSequelize);

      expect(status).toEqual([
        { version: '001', name: 'baseline', applied: true },
        { version: '002', name: 'unique_station_date', applied: false },
      ]);
    });

    it('marks all as not applied when none are applied', async () => {
      mockMigrationsFindAll.mockResolvedValue([]);

      const { migrationService } = await import('../migration.service');
      const status = await migrationService.status(mockSequelize);

      expect(status).toEqual([
        { version: '001', name: 'baseline', applied: false },
        { version: '002', name: 'unique_station_date', applied: false },
      ]);
    });
  });

  describe('isDbEmpty', () => {
    it('returns true when no tables exist', async () => {
      mockSequelize.query = vi.fn().mockResolvedValue([[{ has_tables: false }]]);

      const { migrationService } = await import('../migration.service');
      const result = await migrationService.isDbEmpty(mockSequelize);

      expect(result).toBe(true);
    });

    it('returns false when tables exist', async () => {
      mockSequelize.query = vi.fn().mockResolvedValue([[{ has_tables: true }]]);

      const { migrationService } = await import('../migration.service');
      const result = await migrationService.isDbEmpty(mockSequelize);

      expect(result).toBe(false);
    });
  });

  describe('getLastAppliedVersion', () => {
    it('returns the last applied version', async () => {
      mockMigrationsFindAll.mockResolvedValue([
        { version: '001' },
        { version: '002' },
      ]);

      const { migrationService } = await import('../migration.service');
      const result = await migrationService.getLastAppliedVersion(mockSequelize);

      expect(result).toBe('002');
    });

    it('returns null when no migrations are applied', async () => {
      mockMigrationsFindAll.mockResolvedValue([]);

      const { migrationService } = await import('../migration.service');
      const result = await migrationService.getLastAppliedVersion(mockSequelize);

      expect(result).toBeNull();
    });
  });

  describe('getApplied (private, tested through public methods)', () => {
    it('returns empty array when migrations table does not exist', async () => {
      mockMigrationsFindAll.mockRejectedValue(new Error('Table not found'));

      const { migrationService } = await import('../migration.service');
      const status = await migrationService.status(mockSequelize);

      // All should be unapplied
      expect(status.every((s) => !s.applied)).toBe(true);
    });
  });
});
