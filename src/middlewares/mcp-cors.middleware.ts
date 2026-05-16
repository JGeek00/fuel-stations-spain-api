import type { Request, Response, NextFunction } from 'express';
import { parseCsvEnv } from '@/utils';

/**
 * CORS middleware personalized for MCP routes.
 *
 * Handles the preflight OPTIONS request and sets the required CORS headers
 * for the MCP Streamable HTTP transport (MCP-Session-Id, Accept, etc.).
 *
 * Origin logic mirrors mcpSecurityMiddleware:
 * - If MCP_ALLOWED_ORIGINS is empty or contains '*', allow all origins.
 * - Otherwise, reflect the request Origin if it's in the allowlist.
 */
export const mcpCorsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = parseCsvEnv(process.env.MCP_ALLOWED_ORIGINS);

  const origin = req.headers.origin as string | undefined;
  const allowedOrigin =
    allowedOrigins.length === 0 || allowedOrigins.includes('*')
      ? '*'
      : origin && allowedOrigins.includes(origin)
        ? origin
        : '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Session-Id, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
};
