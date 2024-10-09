import express from 'express';
import * as dotevnv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import database from '@/services/database';
import Router from '@/routes/router'

dotevnv.config()

const app = express();

if (process.env.SENTRY_DSN && process.env.PRODUCTION == "true") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });

  app.use(Sentry.expressErrorHandler);
}

app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(cors())
app.use(helmet())

app.use('/', Router)

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Initialize the database
  database.instance;
});