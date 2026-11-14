import { Sequelize } from 'sequelize';
import { vi } from 'vitest';
import { Migrations, MigrationsModel } from '@/models/db/Migrations';
import { FuelStationsTable, FuelStationModel } from '@/models/db/FuelStations';
import { LastUpdated, LastUpdatedModel } from '@/models/db/LastUpdated';
import { HistoricFuelStation, HistoricFuelStationModel } from '@/models/db/HistoricFuelStation';
import { HistoricNoDataTable, HistoricNoDataModel } from '@/models/db/HistoricNoData';

export const createSqlite = (): Sequelize =>
  new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

export const initMigrationsModel = async (sequelize: Sequelize): Promise<void> => {
  Migrations.init(MigrationsModel, {
    sequelize,
    modelName: 'migrations',
    timestamps: false,
  });
  await Migrations.sync({ force: true });
};

export const initMemoryModels = async (sequelize: Sequelize): Promise<void> => {
  FuelStationsTable.init(FuelStationModel, {
    sequelize,
    modelName: 'FuelStation',
    timestamps: false,
  });
  LastUpdated.init(LastUpdatedModel, {
    sequelize,
    modelName: 'LastUpdated',
    timestamps: false,
  });
  await sequelize.sync({ force: true });
};

export const initHistoricModels = async (sequelize: Sequelize): Promise<void> => {
  HistoricFuelStation.init(HistoricFuelStationModel, {
    sequelize,
    modelName: 'historic_data',
    timestamps: false,
  });
  HistoricNoDataTable.init(HistoricNoDataModel, {
    sequelize,
    modelName: 'historic_no_data',
    timestamps: false,
  });
  await sequelize.sync({ force: true });
};

/**
 * Creates the pre-migration historic_data schema (snake_case columns) that
 * migration 001 expects to find, as raw SQL against the real database.
 */
export const createPreMigrationSchema = async (sequelize: Sequelize): Promise<void> => {
  await sequelize.query(`CREATE TABLE historic_data (
    id TEXT PRIMARY KEY,
    date TEXT,
    "station_id" TEXT,
    "station_signage" TEXT,
    "adblue_price" REAL,
    "ammonia_price" REAL,
    "biodiesel_price" REAL,
    "bioethanol_price" REAL,
    "compressed_biogas_price" REAL,
    "liquefied_biogas_price" REAL,
    "renewable_diesel_price" REAL,
    "cng_price" REAL,
    "lng_price" REAL,
    "lpg_price" REAL,
    "gasoil_a_price" REAL,
    "gasoil_b_price" REAL,
    "premium_gasoil_price" REAL,
    "gasoline_95_e10_price" REAL,
    "gasoline_95_e25_price" REAL,
    "gasoline_95_e5_price" REAL,
    "gasoline_95_e5_premium_price" REAL,
    "gasoline_95_e85_price" REAL,
    "gasoline_98_e10_price" REAL,
    "gasoline_98_e5_price" REAL,
    "renewable_gasoline_price" REAL,
    "hydrogen_price" REAL,
    "methanol_price" REAL
  )`);
};

export const tableColumns = async (
  sequelize: Sequelize,
  table: string
): Promise<string[]> => {
  const [rows] = await sequelize.query(`PRAGMA table_info("${table}")`);
  return (rows as Array<{ name: string }>).map((r) => r.name);
};

export const sqliteObjectNames = async (sequelize: Sequelize): Promise<string[]> => {
  const [rows] = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type IN ('table', 'index')`
  );
  return (rows as Array<{ name: string }>).map((r) => r.name);
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
