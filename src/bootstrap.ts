import * as dotenv from 'dotenv';
dotenv.config();

import { loadSentry } from '@/services/sentry.service';

// Initialize Sentry before anything else
loadSentry();
