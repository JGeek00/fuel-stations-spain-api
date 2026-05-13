import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import ApiRouter from '@/routes/api.routes';
import McpRouter from '@/routes/mcp.routes';
import { sentryEnabled } from '@/services/sentry.service';
import { McpServerManager } from '@/mcp/manager';

export const initExpress = (mcpManager?: McpServerManager): Application => {
  const app = express();

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors());
  app.use(helmet());

  if (mcpManager) {
    app.use('/', McpRouter(mcpManager));
  }

  app.use('/', ApiRouter);

  return app;
};
