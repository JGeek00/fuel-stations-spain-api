import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export const sentryEnabled = process.env.SENTRY_DSN && process.env.PRODUCTION === "true";

export const loadSentry = () => {
  if (sentryEnabled) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        nodeProfilingIntegration(),
      ],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });

    return Sentry;
  }
  return null;
}