import express from 'express';
import cors from "cors"
import helmet from "helmet"
import Router from '@/routes/router'
import * as Sentry from '@sentry/node';
import memoryDatabase from '@/services/memory-database';
import persistedDatabase from '@/services/persisted-database';
import { sentryEnabled } from '@/services/sentry';

export const loadExpress = () => {
  const app = express();

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(express.json())
  app.use(express.urlencoded({extended : true}))
  app.use(cors())
  app.use(helmet())

  app.use('/', Router)

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);

    // Initialize the memory database
    memoryDatabase.instance;

    // Initialize the persisted database
    persistedDatabase.instance;
  });
}