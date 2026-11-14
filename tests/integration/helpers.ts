import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import { ensureMemorySchema } from '@/infrastructure/persistence/ensureMemorySchema';
import { markPersistedDbInitialized } from '@/infrastructure/persistence/memory-db';

/**
 * Fresh `:memory:` schema for realtime specs: ensureMemorySchema() swaps in a
 * new database and creates fuel_stations + last_updated (it also ensures the
 * historic tables, so seeding either side is always safe).
 */
export const initMemorySchema = (): void => {
  ensureMemorySchema();
};

/**
 * Historic/persisted variant: same fresh schema plus the persisted-initialized
 * seam the persisted data service early-exits on (previously set by the
 * HistoricFuelStation adapter's init()).
 */
export const initHistoricSchema = (): void => {
  ensureMemorySchema();
  markPersistedDbInitialized();
};

// ── Postgres helpers (migration integration) ────────────────────────────────

export const hasPostgresEnv = Boolean(
  process.env.POSTGRES_HOST &&
  process.env.POSTGRES_PORT &&
  process.env.POSTGRES_USER &&
  process.env.POSTGRES_PASSWORD &&
  process.env.POSTGRES_DATABASE
);

export const pgConnectionString = hasPostgresEnv
  ? `postgres://${encodeURIComponent(process.env.POSTGRES_USER!)}:${encodeURIComponent(
      process.env.POSTGRES_PASSWORD!
    )}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DATABASE}`
  : '';

export const dropMigrationSurface = async (db: NodePgDatabase<Record<string, never>>): Promise<void> => {
  await db.execute(sql`DROP TABLE IF EXISTS historic_no_data`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_historic_station_date`);
  await db.execute(sql`DROP TABLE IF EXISTS migrations`);
  await db.execute(sql`DROP TABLE IF EXISTS historic_data`);
};

export const createPreMigrationSchema = async (db: NodePgDatabase<Record<string, never>>): Promise<void> => {
  // Pre-migration historic_data schema (snake_case columns) that migration 001
  // expects to find, as raw SQL against the real database.
  await db.execute(sql`CREATE TABLE historic_data (
    id UUID PRIMARY KEY,
    date DATE,
    "station_id" varchar(255),
    "station_signage" varchar(255),
    "adblue_price" double precision,
    "ammonia_price" double precision,
    "biodiesel_price" double precision,
    "bioethanol_price" double precision,
    "compressed_biogas_price" double precision,
    "liquefied_biogas_price" double precision,
    "renewable_diesel_price" double precision,
    "cng_price" double precision,
    "lng_price" double precision,
    "lpg_price" double precision,
    "gasoil_a_price" double precision,
    "gasoil_b_price" double precision,
    "premium_gasoil_price" double precision,
    "gasoline_95_e10_price" double precision,
    "gasoline_95_e25_price" double precision,
    "gasoline_95_e5_price" double precision,
    "gasoline_95_e5_premium_price" double precision,
    "gasoline_95_e85_price" double precision,
    "gasoline_98_e10_price" double precision,
    "gasoline_98_e5_price" double precision,
    "renewable_gasoline_price" double precision,
    "hydrogen_price" double precision,
    "methanol_price" double precision
  )`);
};

export const initMigrationsTable = async (db: NodePgDatabase<Record<string, never>>): Promise<void> => {
  // Same shape the Migrations pgTable declares (service inserts/reads this table).
  await db.execute(sql`CREATE TABLE IF NOT EXISTS migrations (
    "version" varchar(255) PRIMARY KEY,
    "name" varchar(255) NOT NULL,
    "appliedAt" timestamptz DEFAULT now()
  )`);
};

export const tableColumns = async (db: NodePgDatabase<Record<string, never>>, table: string): Promise<string[]> => {
  const result = await db.execute<{ column_name: string }>(
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} ORDER BY ordinal_position`
  );
  return result.rows.map((r: { column_name: string }) => r.column_name);
};

export const objectNames = async (db: NodePgDatabase<Record<string, never>>): Promise<string[]> => {
  const result = await db.execute<{ name: string }>(
    sql`SELECT relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'i')`
  );
  return result.rows.map((r: { name: string }) => r.name);
};

const jsonResponse = (data: unknown) =>
  ({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) }) as Response;

/**
 * Stub for the ONLY external boundary of the data layer: the global fetch.
 * Routes canned provider payloads by URL path, mirroring what
 * DataProviderApiService requests. Call vi.unstubAllGlobals() in afterEach.
 */
export const stubProviderFetch = (options: {
  stations?: unknown;
  municipalities?: unknown;
  historic?: (parts: { day: string; month: string; year: string }) => unknown;
  reject?: Error;
}): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn(async (url: string) => {
    if (options.reject) throw options.reject;
    if (url.includes('/EstacionesTerrestres/')) return jsonResponse(options.stations);
    if (url.includes('/Listados/Municipios')) return jsonResponse(options.municipalities);
    if (url.includes('/EstacionesTerrestresHist/')) {
      const [day, month, year] = String(url.split('/').pop()).split('-');
      return jsonResponse(
        options.historic
          ? options.historic({ day, month, year })
          : { Fecha: `${day}/${month}/${year} 10:00:00`, ListaEESSPrecio: [], Nota: '', ResultadoConsulta: 'OK' }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
};

/**
 * Canned provider station entry shaped like the real /EstacionesTerrestres
 * payload items consumed by FuelStationsMapper.
 */
export const stationEntry = (overrides: Record<string, string> = {}): Record<string, string> => ({
  IDEESS: 'ES000123',
  'C.P.': '28001',
  'Dirección': 'Calle Test 1',
  Horario: '24h',
  Latitud: '40.4168',
  'Longitud (WGS84)': '-3.7038',
  Localidad: 'Madrid',
  Margen: '1',
  Municipio: 'Madrid',
  Provincia: 'MADRID',
  'Remisión': '',
  'Rótulo': 'Test',
  'Tipo Venta': 'P',
  '% BioEtanol': '10',
  '% Éster metílico': '7',
  IDMunicipio: '28079',
  IDProvincia: '28',
  IDCCAA: '29',
  'Precio Adblue': '',
  'Precio Amoniaco': '',
  'Precio Biodiesel': '',
  'Precio Bioetanol': '',
  'Precio Biogas Natural Comprimido': '',
  'Precio Biogas Natural Licuado': '',
  'Precio Diésel Renovable': '',
  'Precio Gas Natural Comprimido': '',
  'Precio Gas Natural Licuado': '',
  'Precio Gases licuados del petróleo': '',
  'Precio Gasoleo A': '1,500',
  'Precio Gasoleo B': '',
  'Precio Gasoleo Premium': '',
  'Precio Gasolina 95 E10': '',
  'Precio Gasolina 95 E25': '',
  'Precio Gasolina 95 E5': '1,650',
  'Precio Gasolina 95 E5 Premium': '',
  'Precio Gasolina 95 E85': '',
  'Precio Gasolina 98 E10': '',
  'Precio Gasolina 98 E5': '',
  'Precio Gasolina Renovable': '',
  'Precio Hidrogeno': '',
  'Precio Metanol': '',
  ...overrides,
});

export const stationsResponse = (stations: Record<string, string>[]) => ({
  Fecha: '15/01/2024 10:00:00',
  ListaEESSPrecio: stations,
  Nota: '',
  ResultadoConsulta: 'OK',
});

export const municipalitiesResponse = () => [
  {
    IDMunicipio: '28079',
    IDProvincia: '28',
    IDCCAA: '29',
    Municipio: 'Madrid',
    Provincia: 'MADRID',
    CCAA: 'Madrid',
  },
];
