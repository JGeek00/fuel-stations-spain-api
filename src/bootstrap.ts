import * as dotenv from 'dotenv';
dotenv.config();

import { loadSentry } from '@/services/sentry/sentry.service';

// Initialize Sentry before anything else
loadSentry();
