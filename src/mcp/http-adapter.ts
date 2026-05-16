import type { Request, Response } from 'express';
import { McpServerManager } from './manager';
import { parseSessionId } from '@/utils/mcp/mcp';

/**
 * Creates Express route handlers for the MCP Streamable HTTP transport.
 *
 * Delegates all session management (create, lookup, destroy, timeout) to
 * the McpServerManager. This layer only handles HTTP request/response wiring.
 *
 * Protocol:
 * - POST    /mcp — JSON-RPC requests. Creates session if no mcp-session-id.
 * - GET     /mcp — SSE stream for server-to-client notifications.
 * - DELETE  /mcp — Close session.
 * - OPTIONS /mcp — CORS preflight (handled by mcpCorsMiddleware).
 *
 * Session validation and DNS rebinding protection are handled by the manager
 * and the MCP SDK transport layer:
 * - Invalid/expired sessions → 404 Not Found
 * - Missing session on non-init requests → 400 Bad Request
 * - MCP-Protocol-Version header → validated automatically by SDK
 */
export function createMcpRouter(manager: McpServerManager) {

  const handlePost = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    // ── New session ──────────────────────────────────────────
    if (!sessionId) {
      const session = manager.createSession();

      // Connect McpServer to transport before handling first request
      await session.mcpServer.server.connect(session.transport);

      await session.transport.handleRequest(
        req as Parameters<typeof session.transport.handleRequest>[0],
        res,
        req.body,
      );

      // sessionId is assigned by the transport inside handleRequest
      if (session.transport.sessionId) {
        manager.setSession(session.transport.sessionId, session);
      }
      return;
    }

    // ── Existing session ─────────────────────────────────────
    const session = manager.getSession(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Session not found. Reinitialize to start a new session.' },
        id: null,
      });
      return;
    }

    // Refresh activity timestamp to prevent timeout eviction
    manager.touchSession(sessionId);

    await session.transport.handleRequest(
      req as Parameters<typeof session.transport.handleRequest>[0],
      res,
      req.body,
    );
  };

  const handleGet = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    if (!sessionId) {
      res.status(400).json({
        error: 'GET requires mcp-session-id. Send POST /mcp first to create a session.',
      });
      return;
    }

    const session = manager.getSession(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Session not found. Reinitialize to start a new session.' },
        id: null,
      });
      return;
    }

    manager.touchSession(sessionId);

    await session.transport.handleRequest(
      req as Parameters<typeof session.transport.handleRequest>[0],
      res,
    );
  };

  const handleDelete = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    if (sessionId) {
      manager.deleteSession(sessionId);
    }

    res.sendStatus(200);
  };

  return { handlePost, handleGet, handleDelete };
}
