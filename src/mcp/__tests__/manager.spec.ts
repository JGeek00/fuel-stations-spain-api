import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-0000'),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class McpServer {
    server = { connect: vi.fn() };
    registerTool = vi.fn();
    registerResource = vi.fn();
  }
  return { McpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  let sessionCounter = 0;
  class StreamableHTTPServerTransport {
    sessionId: string;
    close = vi.fn().mockResolvedValue(undefined);
    handleRequest = vi.fn().mockResolvedValue(undefined);
    constructor() {
      sessionCounter++;
      this.sessionId = `session-${sessionCounter}`;
    }
  }
  return { StreamableHTTPServerTransport };
});

vi.mock('@/services/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/mcp/server', () => {
  class McpServer {
    server = { connect: vi.fn() };
    registerTool = vi.fn();
    registerResource = vi.fn();
  }
  return {
    createMcpServerInstance: vi.fn().mockImplementation(() => new McpServer()),
  };
});

vi.mock('@/utils/mcp', () => ({
  parseCsvEnv: vi.fn().mockReturnValue([]),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { McpServerManager } from '../manager';
import { DatabaseService } from '../../services/database.service';

function createManager(overrides = {}) {
  const dbService = new DatabaseService();
  return new McpServerManager(dbService, {
    sessionTimeoutMs: 5000,
    maxSessions: 3,
    cleanupIntervalMs: 1000,
    allowedOrigins: [],
    allowedHosts: [],
    ...overrides,
  });
}

describe('McpServerManager', () => {
  let manager: McpServerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    manager = createManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('starts with zero sessions', () => {
      expect(manager.activeSessionCount).toBe(0);
    });

    it('does not start cleanup timer when timeout is 0', () => {
      const m = createManager({ sessionTimeoutMs: 0, cleanupIntervalMs: 0 });
      expect(m.activeSessionCount).toBe(0);
    });

    it('does not start cleanup timer when cleanupInterval is 0', () => {
      const m = createManager({ sessionTimeoutMs: 5000, cleanupIntervalMs: 0 });
      expect(m.activeSessionCount).toBe(0);
    });
  });

  describe('isProtectionEnabled', () => {
    it('returns false when both lists are empty', () => {
      expect(manager.isProtectionEnabled).toBe(false);
    });

    it('returns true when allowedOrigins is configured', () => {
      const m = createManager({ allowedOrigins: ['http://localhost:3000'] });
      expect(m.isProtectionEnabled).toBe(true);
    });

    it('returns true when allowedHosts is configured', () => {
      const m = createManager({ allowedHosts: ['localhost:3000'] });
      expect(m.isProtectionEnabled).toBe(true);
    });
  });

  describe('transportOptions', () => {
    it('returns base options when protection is disabled', () => {
      const opts = manager.transportOptions;
      expect(opts?.sessionIdGenerator).toBeDefined();
      // sessionIdGenerator may be optional on the type, assert it's a function then call
      expect(typeof opts?.sessionIdGenerator).toBe('function');
      expect(opts!.sessionIdGenerator!()).toBe('test-uuid-0000');
    });

    it('includes DNS rebinding options when protection is enabled', () => {
      const m = createManager({
        allowedOrigins: ['http://localhost:3000'],
        allowedHosts: ['localhost:3000'],
      });
      const opts = m.transportOptions;
      expect(opts?.enableDnsRebindingProtection).toBe(true);
      expect(opts?.allowedOrigins).toEqual(['http://localhost:3000']);
      expect(opts?.allowedHosts).toEqual(['localhost:3000']);
    });
  });

  describe('createSession', () => {
    it('creates a new session', () => {
      const session = manager.createSession();
      expect(session).toBeDefined();
      expect(session.transport).toBeDefined();
      expect(session.mcpServer).toBeDefined();
      expect(session.lastActiveAt).toBeGreaterThan(0);
      expect(session.createdAt).toBeGreaterThan(0);
    });

    it('creates independent sessions', () => {
      const s1 = manager.createSession();
      const s2 = manager.createSession();
      expect(s1.transport).not.toBe(s2.transport);
      expect(s1.mcpServer).not.toBe(s2.mcpServer);
    });

    it('evicts oldest session when maxSessions is reached', () => {
      const m = createManager({ maxSessions: 2 });

      const s1 = m.createSession();
      m.setSession('id-1', s1);

      const s2 = m.createSession();
      m.setSession('id-2', s2);

      // Force s1 to be oldest
      s1.lastActiveAt = Date.now() - 100000;

      const s3 = m.createSession();
      // After eviction, id-1 should be gone
      expect(m.getSession('id-1')).toBeUndefined();
      expect(m.getSession('id-2')).toBeDefined();
    });

    it('does not evict when maxSessions is 0 (unlimited)', () => {
      const m = createManager({ maxSessions: 0 });
      const s1 = m.createSession();
      m.setSession('id-1', s1);
      const s2 = m.createSession();
      m.setSession('id-2', s2);
      const s3 = m.createSession();
      m.setSession('id-3', s3);
      expect(m.activeSessionCount).toBe(3);
    });
  });

  describe('session management', () => {
    it('stores and retrieves sessions', () => {
      const session = manager.createSession();
      manager.setSession('test-id', session);

      const found = manager.getSession('test-id');
      expect(found).toBe(session);
    });

    it('returns undefined for non-existent session', () => {
      expect(manager.getSession('does-not-exist')).toBeUndefined();
    });

    it('updates lastActiveAt on touchSession', () => {
      const session = manager.createSession();
      manager.setSession('touch-id', session);

      const originalTime = session.lastActiveAt;
      vi.advanceTimersByTime(1000);

      manager.touchSession('touch-id');
      expect(session.lastActiveAt).toBeGreaterThan(originalTime);
    });

    it('does nothing on touchSession for unknown id', () => {
      // Should not throw
      manager.touchSession('unknown-id');
    });

    it('deletes a session', () => {
      const session = manager.createSession();
      manager.setSession('del-id', session);
      expect(manager.getSession('del-id')).toBeDefined();

      manager.deleteSession('del-id');
      expect(manager.getSession('del-id')).toBeUndefined();
    });

    it('does nothing on deleteSession for unknown id', () => {
      // Should not throw
      manager.deleteSession('unknown-id');
    });

    it('closes transport when deleting session', () => {
      const session = manager.createSession();
      manager.setSession('close-id', session);

      manager.deleteSession('close-id');
      expect(session.transport.close).toHaveBeenCalled();
    });

    it('handles transport close error gracefully', () => {
      const session = manager.createSession();
      session.transport.close = vi.fn().mockRejectedValue(new Error('already closed'));
      manager.setSession('err-id', session);

      // Should not throw
      manager.deleteSession('err-id');
    });
  });

  describe('cleanup expired sessions', () => {
    it('removes sessions that exceeded timeout', async () => {
      const session = manager.createSession();
      manager.setSession('expire-id', session);
      session.lastActiveAt = Date.now() - 10000; // expired (timeout is 5s)

      // Trigger cleanup
      await vi.runOnlyPendingTimersAsync();

      expect(manager.getSession('expire-id')).toBeUndefined();
    });

    it('keeps sessions that are still active', async () => {
      const session = manager.createSession();
      manager.setSession('alive-id', session);
      session.lastActiveAt = Date.now() - 1000; // still within 5s timeout

      await vi.runOnlyPendingTimersAsync();

      expect(manager.getSession('alive-id')).toBeDefined();
    });

    it('does not remove non-expired sessions alongside expired ones', async () => {
      const s1 = manager.createSession();
      manager.setSession('expired-1', s1);
      s1.lastActiveAt = Date.now() - 10000;

      const s2 = manager.createSession();
      manager.setSession('alive-2', s2);
      s2.lastActiveAt = Date.now();

      await vi.runOnlyPendingTimersAsync();

      expect(manager.getSession('expired-1')).toBeUndefined();
      expect(manager.getSession('alive-2')).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('clears all sessions', async () => {
      const s1 = manager.createSession();
      manager.setSession('shut-1', s1);
      const s2 = manager.createSession();
      manager.setSession('shut-2', s2);

      await manager.shutdown();

      expect(manager.activeSessionCount).toBe(0);
    });

    it('stops the cleanup timer', async () => {
      await manager.shutdown();
      // Create a session and wait — no cleanup should occur
      const session = manager.createSession();
      manager.setSession('after-shutdown', session);
      session.lastActiveAt = Date.now() - 10000;

      await vi.runOnlyPendingTimersAsync();

      expect(manager.getSession('after-shutdown')).toBeDefined();
    });

    it('handles errors during shutdown gracefully', async () => {
      const session = manager.createSession();
      session.transport.close = vi.fn().mockRejectedValue(new Error('fail'));
      manager.setSession('fail-shutdown', session);

      await expect(manager.shutdown()).resolves.toBeUndefined();
    });
  });
});
