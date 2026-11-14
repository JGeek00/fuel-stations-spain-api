import * as dotenv from 'dotenv';
dotenv.config();

import { loadSentry } from '@/infrastructure/observability/sentry.service';

// Initialize Sentry before anything else
loadSentry();
