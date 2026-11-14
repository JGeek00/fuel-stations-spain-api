import { Migration } from '@/domain/entities';

import migration001 from './001_baseline';
import migration002 from './002_unique_station_date';
import migration003 from './003_ensure_historic_schema';

export const MIGRATIONS: Migration[] = [migration001, migration002, migration003];
MIGRATIONS.sort((a, b) => a.version.localeCompare(b.version));
