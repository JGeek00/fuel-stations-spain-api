import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import ApiRouter from '@/routes/api.routes';
import McpRouter from '@/routes/mcp.routes';
import { sentryEnabled } from '@/services/sentry.service';
import { McpServerManager } from '@/mcp/manager';
import { errorHandlerMiddleware } from '@/middlewares/error-middleware/error-handler.middleware';

export const initExpress = (mcpManager?: McpServerManager): Application => {
  const app = express();

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors());
  app.use(helmet());

  if (process.env.API_RESPONSE_LOGGING !== 'false') {
    if (process.env.NODE_ENV === 'development') {
      app.use(morgan('dev'));
    } else {
      app.use(morgan('combined'));
    }
  }

  if (mcpManager) {
    app.use('/', McpRouter(mcpManager));
  }

  app.use('/', ApiRouter);

  // Global error handler — must be after all routes
  app.use(errorHandlerMiddleware);

  return app;
};
