// Load Sentry before anything else
import '@/bootstrap';

import packageJson from '../package.json';
import { initExpress } from '@/express';
import { databaseService } from '@/services/database.service';
import { McpServerManager } from '@/mcp/manager';
import { logger } from '@/utils/logger';
import { validateHistoricDataMaxRange } from '@/utils/historic-data-limit';

const step = (label: string, status: '✓' | '⚠' | '✗', detail?: string): void => {
  const paddedLabel = label.padEnd(36, '.');
  const suffix = detail ? ` (${detail})` : '';
  logger.banner(`  ${paddedLabel} ${status}${suffix}`);
};

const validateEnvironment = (): void => {
  const port = process.env.PORT;
  if (port && Number.isNaN(Number(port))) {
    logger.error('❌ ERROR: PORT must be a number');
    process.exit(1);
  }
};

export const startServer = async (): Promise<void> => {
  try {
    logger.banner('');
    logger.banner('  ╔══════════════════════════════════════╗');
    logger.banner(`  ║   Fuel Stations Spain API  v${packageJson.version.padEnd(12)}║`);
    logger.banner('  ╚══════════════════════════════════════╝');
    logger.banner('');

    // Validate environment
    validateEnvironment();
    step('Environment', '✓', `PORT=${process.env.PORT ?? '3000'}`);

    // Validate HISTORIC_DATA_MAX_RANGE
    const historicLimitResult = validateHistoricDataMaxRange();
    step('Historic data limit', historicLimitResult.status, historicLimitResult.detail);

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
      logger.banner('');
      logger.banner('  ┌─────────────────────────────────────┐');
      logger.banner('  │  Server ready                       │');
      logger.banner(`  │  Port:        ${String(port).padEnd(22)}│`);
      logger.banner(`  │  Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(22)}│`);
      logger.banner('  └─────────────────────────────────────┘');
      logger.banner('');
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n  Shutting down gracefully (${signal})...`);
      if (mcpManager) {
        await mcpManager.shutdown();
      }
      server.close(() => process.exit(signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1));
    };

    // Graceful handling for unhandled rejections and exceptions
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
