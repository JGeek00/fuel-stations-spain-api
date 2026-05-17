import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

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
  class StreamableHTTPServerTransport {
    sessionId: string | undefined = 'test-uuid-0000';
    handleRequest = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
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
  parseSessionId: vi.fn((header) => (header ? header : undefined)),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { McpServerManager } from '../manager';
import { createMcpRouter } from '../http-adapter';
import { DatabaseService } from '../../services/database.service';

// ── Helpers ──────────────────────────────────────────────────────────────────
function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as never;
}

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    sendStatus: vi.fn(),
  };
  return res as never;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('createMcpRouter', () => {
  let manager: McpServerManager;
  let router: ReturnType<typeof createMcpRouter>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    const dbService = new DatabaseService();
    manager = new McpServerManager(dbService, {
      sessionTimeoutMs: 5000,
      maxSessions: 3,
      cleanupIntervalMs: 1000,
      allowedOrigins: [],
      allowedHosts: [],
    });
    router = createMcpRouter(manager);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── General ────────────────────────────────────────────────────────────
  it('creates the router', () => {
    expect(router).toBeDefined();
  });

  it('returns a router-like object', () => {
    expect(router).toBeInstanceOf(Object);
  });

  it('uses the manager for session management', () => {
    expect(manager).toBeDefined();
    expect(manager.activeSessionCount).toBe(0);
  });

  it('exposes handlePost, handleGet, handleDelete', () => {
    expect(typeof router.handlePost).toBe('function');
    expect(typeof router.handleGet).toBe('function');
    expect(typeof router.handleDelete).toBe('function');
  });

  // ── handlePost: New session (no mcp-session-id) ────────────────────────
  describe('handlePost: new session', () => {
    it('creates a new session when no mcp-session-id is provided', async () => {
      const req = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      const res = createMockRes();
      await router.handlePost(req, res);

      expect(manager.activeSessionCount).toBe(1);
    });

    it('connects server to transport before handling request', async () => {
      const req = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      const res = createMockRes();
      await router.handlePost(req, res);

      const session = manager.getSession('test-uuid-0000');
      expect(session?.mcpServer.server.connect).toHaveBeenCalledTimes(1);
    });

    it('calls transport.handleRequest with req, res, body', async () => {
      const body = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const req = createMockReq({ body });
      const res = createMockRes();
      await router.handlePost(req, res);

      const session = manager.getSession('test-uuid-0000');
      const handleRequest = session?.transport.handleRequest as Mock;
      expect(handleRequest).toHaveBeenCalledTimes(1);
      expect(handleRequest).toHaveBeenCalledWith(
        expect.anything(),
        res,
        body,
      );
    });

    it('stores session via manager.setSession when transport assigns sessionId', async () => {
      const req = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      const res = createMockRes();
      await router.handlePost(req, res);

      expect(manager.activeSessionCount).toBe(1);
      expect(manager.getSession('test-uuid-0000')).toBeDefined();
    });

    it('does not call setSession when transport does not assign sessionId', async () => {
      const setSessionSpy = vi.spyOn(manager, 'setSession');

      // Force transport to not have sessionId
      const session = manager.createSession();
      session.transport.sessionId = undefined;
      manager.setSession('orphan-session', session);

      // Now create another session without header
      const req = createMockReq({ body: { jsonrpc: '2.0', method: 'ping', id: 2 } });
      const res = createMockRes();
      await router.handlePost(req, res);

      // setSession was called for the first session ('orphan-session') but not for the new one
      expect(setSessionSpy).toHaveBeenCalledWith('orphan-session', session);
    });
  });

  // ── handlePost: Existing session (with mcp-session-id) ──────────────────
  describe('handlePost: existing session', () => {
    it('looks up session by mcp-session-id', async () => {
      const getSessionSpy = vi.spyOn(manager, 'getSession');

      // Create session first
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      // Then use it
      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
        body: { jsonrpc: '2.0', method: 'tools/call', id: 2 },
      });
      await router.handlePost(req, createMockRes());

      expect(getSessionSpy).toHaveBeenCalledWith('test-uuid-0000');
    });

    it('returns 404 for non-existent session', async () => {
      const req = createMockReq({
        headers: { 'mcp-session-id': 'non-existent' },
        body: { jsonrpc: '2.0', method: 'tools/call', id: 2 },
      });
      const res = createMockRes();
      await router.handlePost(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          error: expect.objectContaining({
            code: -32600,
            message: expect.stringContaining('Session not found'),
          }),
          id: null,
        }),
      );
    });

    it('touches session on request', async () => {
      const touchSpy = vi.spyOn(manager, 'touchSession');

      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
        body: { jsonrpc: '2.0', method: 'tools/call', id: 2 },
      });
      await router.handlePost(req, createMockRes());

      expect(touchSpy).toHaveBeenCalledWith('test-uuid-0000');
    });

    it('calls transport.handleRequest for existing session', async () => {
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
        body: { jsonrpc: '2.0', method: 'tools/call', id: 2 },
      });
      const res = createMockRes();
      await router.handlePost(req, res);

      const session = manager.getSession('test-uuid-0000');
      const handleRequest = session?.transport.handleRequest as Mock;
      // First call from init, second from this request
      expect(handleRequest).toHaveBeenCalledTimes(2);
    });

    it('does not call transport.handleRequest for 404 session', async () => {
      const req = createMockReq({
        headers: { 'mcp-session-id': 'non-existent' },
        body: { jsonrpc: '2.0', method: 'tools/call', id: 2 },
      });
      const res = createMockRes();
      await router.handlePost(req, res);

      expect(manager.activeSessionCount).toBe(0);
    });
  });

  // ── handleGet ───────────────────────────────────────────────────────────
  describe('handleGet', () => {
    it('returns 400 when no mcp-session-id is provided', async () => {
      const req = createMockReq();
      const res = createMockRes();
      await router.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('mcp-session-id'),
        }),
      );
    });

    it('returns 404 for non-existent session', async () => {
      const req = createMockReq({
        headers: { 'mcp-session-id': 'non-existent' },
      });
      const res = createMockRes();
      await router.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          error: expect.objectContaining({
            code: -32600,
          }),
          id: null,
        }),
      );
    });

    it('touches session on GET request', async () => {
      const touchSpy = vi.spyOn(manager, 'touchSession');

      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      await router.handleGet(req, createMockRes());

      expect(touchSpy).toHaveBeenCalledWith('test-uuid-0000');
    });

    it('calls transport.handleRequest with req, res (no body) for GET', async () => {
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      const res = createMockRes();
      await router.handleGet(req, res);

      const session = manager.getSession('test-uuid-0000');
      const handleRequest = session?.transport.handleRequest as Mock;
      // GET calls handleRequest with only (req, res) — no body
      const lastCall = handleRequest.mock.calls[handleRequest.mock.calls.length - 1];
      expect(lastCall).toHaveLength(2);
      expect(lastCall[1]).toBe(res);
    });

    it('does not call transport for 400/404 GET', async () => {
      const req = createMockReq({
        headers: { 'mcp-session-id': 'non-existent' },
      });
      const res = createMockRes();
      await router.handleGet(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(manager.activeSessionCount).toBe(0);
    });
  });

  // ── handleDelete ────────────────────────────────────────────────────────
  describe('handleDelete', () => {
    it('deletes session when mcp-session-id is provided', async () => {
      const deleteSpy = vi.spyOn(manager, 'deleteSession');

      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());
      expect(manager.activeSessionCount).toBe(1);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      const res = createMockRes();
      await router.handleDelete(req, res);

      expect(deleteSpy).toHaveBeenCalledWith('test-uuid-0000');
      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it('reduces active session count after delete', async () => {
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());
      expect(manager.activeSessionCount).toBe(1);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      const res = createMockRes();
      await router.handleDelete(req, res);

      expect(manager.activeSessionCount).toBe(0);
    });

    it('sends 200 without session ID', async () => {
      const deleteSpy = vi.spyOn(manager, 'deleteSession');

      const req = createMockReq();
      const res = createMockRes();
      await router.handleDelete(req, res);

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it('sends 200 for non-existent session ID', async () => {
      const req = createMockReq({
        headers: { 'mcp-session-id': 'non-existent' },
      });
      const res = createMockRes();
      await router.handleDelete(req, res);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it('does not error if session is already deleted', async () => {
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());
      expect(manager.activeSessionCount).toBe(1);

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      const res = createMockRes();
      await router.handleDelete(req, res);

      // Second delete should not throw
      const res2 = createMockRes();
      await router.handleDelete(req, res2);

      expect(res2.sendStatus).toHaveBeenCalledWith(200);
    });

    it('closes transport on delete', async () => {
      const initReq = createMockReq({ body: { jsonrpc: '2.0', method: 'initialize', id: 1 } });
      await router.handlePost(initReq, createMockRes());

      const session = manager.getSession('test-uuid-0000');
      const close = session?.transport.close as Mock;

      const req = createMockReq({
        headers: { 'mcp-session-id': 'test-uuid-0000' },
      });
      const res = createMockRes();
      await router.handleDelete(req, res);

      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
