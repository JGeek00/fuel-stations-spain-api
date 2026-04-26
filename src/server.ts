import * as dotenv from 'dotenv';
dotenv.config();

import packageJson from '../package.json';
import { initExpress } from '@/express';
import { databaseService } from '@/services/database.service';
import { loadSentry } from '@/services/sentry.service';

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
    } catch {
      step('Persisted DB', '⚠', 'disabled');
    }

    // Create and start Express app
    const app = initExpress();

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

    // Graceful handling for unhandled rejections and exceptions
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      server.close(() => process.exit(1));
    });

    process.on('SIGTERM', () => {
      console.log('\n  Shutting down gracefully (SIGTERM)...');
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      console.log('\n  Shutting down gracefully (SIGINT)...');
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();