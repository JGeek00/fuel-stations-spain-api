import express from 'express';
import cors from "cors"
import helmet from "helmet"
import Router from '@/routes/router'
import * as Sentry from '@sentry/node';
import memoryDatabase from '@/services/memory-database';
import { sentryEnabled } from '@/services/sentry';
import PersistedDatabase from './persisted-database';
import MemoryDatabase from '@/services/memory-database';

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
    new MemoryDatabase();

    // Initialize the persisted database
    new PersistedDatabase();
  });
}