import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Validates a session ID header value. Returns the ID if valid, undefined otherwise.
 */
function parseSessionId(raw: string | undefined): string | undefined {
  if (!raw || raw === 'null' || raw === 'undefined') return undefined;
  return raw;
}

/**
 * Parses a comma-separated environment variable into a string array.
 */
function parseCsvEnv(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Creates Express route handlers for the MCP Streamable HTTP transport.
 *
 * Each client session gets its own independent McpServer + transport pair.
 * The MCP SDK only allows one transport per McpServer instance, so we create
 * a fresh server per session via the provided factory.
 *
 * Protocol:
 * - POST   /mcp — JSON-RPC requests. Creates session if no mcp-session-id.
 * - GET    /mcp — SSE stream for server-to-client notifications.
 * - DELETE /mcp — Close session.
 *
 * Session validation and DNS rebinding protection are delegated to the MCP SDK
 * which handles them per spec 2025-11-25:
 * - Invalid/expired sessions → 404 Not Found
 * - Missing session on non-init requests → 400 Bad Request
 * - MCP-Protocol-Version header → validated automatically
 */
export function createMcpRouter(serverFactory: () => McpServer) {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // DNS rebinding protection options from environment
  const allowedOrigins = parseCsvEnv(process.env.MCP_ALLOWED_ORIGINS);
  const allowedHosts = parseCsvEnv(process.env.MCP_ALLOWED_HOSTS);
  const enableProtection = allowedOrigins.length > 0 || allowedHosts.length > 0;

  const transportOptions: ConstructorParameters<typeof StreamableHTTPServerTransport>[0] = {
    sessionIdGenerator: () => randomUUID(),
    ...(enableProtection ? {
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
      enableDnsRebindingProtection: true,
    } : {}),
  };

  const handlePost = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    if (sessionId && transports.has(sessionId)) {
      // Existing session
    } else if (!sessionId) {
      // New session — create transport and McpServer
      const transport = new StreamableHTTPServerTransport(transportOptions);
      const mcpServer = serverFactory();
      await mcpServer.server.connect(transport);

      await transport.handleRequest(req as unknown as Parameters<typeof transport.handleRequest>[0], res, req.body);

      // sessionId is populated after the first handleRequest
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
      return;
    } else {
      // Stale session ID — 404 Not Found per spec 2025-11-25
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Session not found. Reinitialize to start a new session.' },
        id: null
      });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req as unknown as Parameters<typeof transport.handleRequest>[0], res, req.body);

    // Ensure session is stored (in case it was missed after first request)
    if (transport.sessionId && !transports.has(transport.sessionId)) {
      transports.set(transport.sessionId, transport);
    }
  };

  const handleGet = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    if (!sessionId) {
      res.status(400).json({ error: 'GET requires mcp-session-id. Send POST /mcp first to create a session.' });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      // Stale session ID — 404 Not Found per spec 2025-11-25
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Session not found. Reinitialize to start a new session.' },
        id: null
      });
      return;
    }

    await transport.handleRequest(req as unknown as Parameters<typeof transport.handleRequest>[0], res);
  };

  const handleDelete = async (req: Request, res: Response) => {
    const sessionId = parseSessionId(req.headers['mcp-session-id'] as string | undefined);

    if (sessionId) {
      const transport = transports.get(sessionId);
      if (transport) {
        transports.delete(sessionId);
        await transport.close();
      }
    }

    res.sendStatus(200);
  };

  return { handlePost, handleGet, handleDelete, transports };
}
