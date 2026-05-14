import { Migration } from '@/models/entities';

import migration001 from './001_baseline';

export const MIGRATIONS: Migration[] = [migration001];
MIGRATIONS.sort((a, b) => a.version.localeCompare(b.version));
