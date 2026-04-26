import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import Router from '@/routes/router';
import { sentryEnabled } from '@/services/sentry.service';

export const initExpress = (): Application => {
  const app = express();

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(helmet());

  app.use('/', Router);

  return app;
};