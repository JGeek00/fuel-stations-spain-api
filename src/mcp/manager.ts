import { randomUUID } from 'crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DatabaseService } from '@/services/database/database.service';
import { createMcpServerInstance } from '@/mcp/server';
import { parseCsvEnv } from '@/utils/mcp/mcp';

/**
 * Represents a single active MCP client session.
 * Each session has its own McpServer + StreamableHTTPServerTransport pair
 * (required by the MCP SDK which only supports one transport per server).
 */
export interface McpSession {
  transport: StreamableHTTPServerTransport;
  mcpServer: McpServer;
  lastActiveAt: number;
  createdAt: number;
}

/**
 * Configuration for the MCP session manager.
 * All values can be overridden via environment variables.
 */
interface ManagerConfig {
  /** Max idle time before session is cleaned up (default: 24h) */
  sessionTimeoutMs: number;
  /** Maximum concurrent sessions (default: 100) */
  maxSessions: number;
  /** Cleanup interval in ms (default: 5min) */
  cleanupIntervalMs: number;
  /** Allowed origins for DNS rebinding protection */
  allowedOrigins: string[];
  /** Allowed hosts for DNS rebinding protection */
  allowedHosts: string[];
}

const DEFAULT_CONFIG: ManagerConfig = {
  sessionTimeoutMs: Number(process.env.MCP_SESSION_TIMEOUT_MS ?? 86_400_000),
  maxSessions: Number(process.env.MCP_MAX_SESSIONS ?? 100),
  cleanupIntervalMs: Number(process.env.MCP_SESSION_CLEANUP_INTERVAL_MS ?? 300_000),
  allowedOrigins: parseCsvEnv(process.env.MCP_ALLOWED_ORIGINS),
  allowedHosts: parseCsvEnv(process.env.MCP_ALLOWED_HOSTS),
};


/**
 * Singleton manager that owns all MCP sessions.
 *
 * Architecture:
 * - One McpServerManager per application (created at startup)
 * - Each client session gets its own McpServer + Transport pair
 *   (MCP SDK limitation: one transport per server)
 * - Expired sessions are cleaned up periodically
 * - Session count is capped at maxSessions
 */
export class McpServerManager {
  private sessions = new Map<string, McpSession>();
  private readonly config: ManagerConfig;
  private readonly databaseService: DatabaseService;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(databaseService: DatabaseService, config: Partial<ManagerConfig> = {}) {
    this.databaseService = databaseService;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start periodic cleanup if timeout is configured
    if (this.config.sessionTimeoutMs > 0 && this.config.cleanupIntervalMs > 0) {
      this.startCleanupInterval();
    }
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  get isProtectionEnabled(): boolean {
    return this.config.allowedOrigins.length > 0 || this.config.allowedHosts.length > 0;
  }

  get transportOptions(): ConstructorParameters<typeof StreamableHTTPServerTransport>[0] {
    const base: ConstructorParameters<typeof StreamableHTTPServerTransport>[0] = {
      sessionIdGenerator: () => randomUUID(),
    };

    if (this.isProtectionEnabled) {
      return {
        ...base,
        allowedOrigins: this.config.allowedOrigins.length > 0
          ? this.config.allowedOrigins
          : undefined,
        allowedHosts: this.config.allowedHosts.length > 0
          ? this.config.allowedHosts
          : undefined,
        enableDnsRebindingProtection: true,
      };
    }

    return base;
  }

  /**
   * Create a new session (McpServer + Transport pair).
   * If maxSessions is reached, the oldest idle session is evicted first.
   */
  createSession(): McpSession {
    this.enforceMaxSessions();

    const mcpServer = createMcpServerInstance(this.databaseService);
    const transport = new StreamableHTTPServerTransport(this.transportOptions);

    const session: McpSession = {
      transport,
      mcpServer,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
    };

    return session;
  }

  /** Get an existing session by ID */
  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Store a session in the manager's map.
   * Called after transport.handleRequest assigns the sessionId.
   */
  setSession(sessionId: string, session: McpSession): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * Update the last-active timestamp for a session.
   * Call on every request to prevent timeout eviction.
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = Date.now();
    }
  }

  /**
   * Delete and close a session. Cleans up both transport and McpServer.
   */
  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    this.closeSession(session);
  }

  /**
   * Shutdown the manager: close all sessions and stop cleanup timer.
   * Call during graceful shutdown.
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const sessions = Array.from(this.sessions.values());
    this.sessions.clear();

    await Promise.allSettled(sessions.map(s => this.closeSession(s)));
  }



  private async closeSession(session: McpSession): Promise<void> {
    try {
      await session.transport.close();
    } catch {
      // Transport already closed or error — non-fatal
    }
  }

  private enforceMaxSessions(): void {
    if (this.config.maxSessions <= 0) return;
    if (this.sessions.size < this.config.maxSessions) return;

    // Evict the oldest idle session
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt < oldestTime) {
        oldestTime = session.lastActiveAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.deleteSession(oldestId);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupIntervalMs);

    // Don't let cleanup interval keep the process alive
    (this.cleanupTimer as ReturnType<typeof setInterval> & { unref?: () => void })?.unref?.();
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired = new Set<string>();

    for (const [id, session] of this.sessions) {
      const idleTime = now - session.lastActiveAt;
      if (idleTime > this.config.sessionTimeoutMs) {
        expired.add(id);
      }
    }

    for (const id of expired) {
      this.deleteSession(id);
    }
  }
}
