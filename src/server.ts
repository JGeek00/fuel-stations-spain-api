import * as dotenv from 'dotenv';
dotenv.config();

import packageJson from '../package.json';
import { initExpress } from '@/express';
import { databaseService } from '@/services/database.service';
import { loadSentry } from '@/services/sentry.service';
import { McpServerManager } from '@/mcp/manager';

const step = (label: string, status: '✓' | '⚠' | '✗', detail?: string): void => {
  const paddedLabel = label.padEnd(36, '.');
  const suffix = detail ? ` (${detail})` : '';
  console.log(`  ${paddedLabel} ${status}${suffix}`);
};

const validateEnvironment = (): void => {
  const port = process.env.PORT;
  if (port && Number.isNaN(Number(port))) {
    console.error('❌ ERROR: PORT must be a number');
    process.exit(1);
  }
};

export const startServer = async (): Promise<void> => {
  try {
    // Initialize Sentry if configured
    loadSentry();

    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log(`  ║   Fuel Stations Spain API  v${packageJson.version.padEnd(12)}║`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');

    // Validate environment
    validateEnvironment();
    step('Environment', '✓', `PORT=${process.env.PORT ?? '3000'}`);

    // Initialize both databases via databaseService
    await databaseService.init();
    step('Memory DB', '✓');
    try {
      databaseService.persistedDbInstance;
      step('Persisted DB', '✓', 'postgres');
      step('Migrations', '✓');
    } catch {
      step('Persisted DB', '⚠', 'disabled');
    }

    const mcpManager = (() => {
      if (process.env.ENABLE_MCP != "false") {
        step('MCP Server', '✓');
        return new McpServerManager(databaseService);
      }
      step('MCP Server', '⚠', 'disabled');
      return undefined;
    })();

    const app = initExpress(mcpManager);

    const port = Number(process.env.PORT ?? 3000);
    const server = app.listen(port, () => {
      console.log('');
      console.log('  ┌─────────────────────────────────────┐');
      console.log('  │  Server ready                       │');
      console.log(`  │  Port:        ${String(port).padEnd(22)}│`);
      console.log(`  │  Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(22)}│`);
      console.log('  └─────────────────────────────────────┘');
      console.log('');
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n  Shutting down gracefully (${signal})...`);
      if (mcpManager) {
        await mcpManager.shutdown();
      }
      server.close(() => process.exit(signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1));
    };

    // Graceful handling for unhandled rejections and exceptions
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();