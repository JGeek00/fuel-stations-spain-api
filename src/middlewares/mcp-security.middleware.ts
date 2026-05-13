import { Request, Response, NextFunction } from 'express';
import { parseCsvEnv } from "@/utils/mcp";

/**
 * Middleware for MCP endpoint security (DNS rebinding protection).
 * Validates Origin and Host headers per MCP specification.
 *
 * Per spec 2025-11-25:
 * - Servers MUST validate the Origin header to prevent DNS rebinding attacks
 * - If Origin is present and invalid, respond with 403 Forbidden
 * - Servers SHOULD bind only to localhost when running locally
 */
export const mcpSecurityMiddleware = (req: Request, _res: Response, next: NextFunction): void  => {
  const allowedOrigins = parseCsvEnv(process.env.MCP_ALLOWED_ORIGINS);
  const allowedHosts = parseCsvEnv(process.env.MCP_ALLOWED_HOSTS);

  // If both are empty/undefined, protection is disabled
  if (allowedOrigins.length === 0 && allowedHosts.length === 0) {
    next();
    return;
  }

  const origin = req.headers.origin as string | undefined;
  const host = req.headers.host as string | undefined;

  // Validate Origin if configured
  if (allowedOrigins.length > 0 && origin) {
    if (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
      _res.status(403).json({
        error: -32000,
        message: `Invalid Origin header: ${origin}`
      });
      return;
    }
  }

  // Validate Host if configured
  if (allowedHosts.length > 0 && host) {
    if (!allowedHosts.includes('*') && !allowedHosts.includes(host)) {
      _res.status(403).json({
        error: -32000,
        message: `Invalid Host header: ${host}`
      });
      return;
    }
  }

  next();
}