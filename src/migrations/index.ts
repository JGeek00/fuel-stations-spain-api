import { Migration } from '@/models/entities';

import migration001 from './001_baseline';
import migration002 from './002_unique_station_date';

export const MIGRATIONS: Migration[] = [migration001, migration002];
MIGRATIONS.sort((a, b) => a.version.localeCompare(b.version));
