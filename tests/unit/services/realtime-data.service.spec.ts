import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
}));

// Mock CronJob
const mockCronJobFrom = vi.fn();
vi.mock('cron', () => ({
  CronJob: {
    from: mockCronJobFrom,
  },
}));

// Mock DataProviderApiService (the real module, shim re-exports from it)
const mockGetStations = vi.fn();
const mockGetMunicipalities = vi.fn();
vi.mock('@/services/data-provider-api.service', () => ({
  DataProviderApiService: {
    getStations: mockGetStations,
    getMunicipalities: mockGetMunicipalities,
  },
}));

// Mock FuelStationsMapper
const mockMap = vi.fn();
vi.mock('@/mapper', () => ({
  FuelStationsMapper: {
    map: mockMap,
  },
}));

// Drizzle memory DB seam (src/models/db/memory-db.ts)
const { mockDb, fuelStationsTable, lastUpdatedTable } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  },
  fuelStationsTable: { name: 'fuelStationsTable' },
  lastUpdatedTable: { name: 'lastUpdatedTable' },
}));
vi.mock('@/models/db/memory-db', () => ({
  getMemoryDb: () => mockDb,
  fuelStationsTable,
  lastUpdatedTable,
}));

let insertedRows: { table: unknown; values: unknown }[] = [];

// Wires the mockDb chain for one scenario. `failFirstFuelInsert` simulates the
// new-stations insert failing so the restore path runs.
const seedDb = (options: { fuelStations?: unknown[]; lastUpdated?: unknown[]; failFirstFuelInsert?: boolean } = {}) => {
  insertedRows = [];
  let fuelInsertAttempts = 0;
  mockDb.select.mockImplementation(() => ({
    from: vi.fn(async (table: unknown) =>
      table === fuelStationsTable ? (options.fuelStations ?? []) : (options.lastUpdated ?? [])
    ),
  }));
  mockDb.delete.mockResolvedValue(undefined);
  mockDb.insert.mockImplementation((table: unknown) => ({
    values: vi.fn(async (values: unknown) => {
      insertedRows.push({ table, values });
      if (table === fuelStationsTable && options.failFirstFuelInsert) {
        fuelInsertAttempts += 1;
        if (fuelInsertAttempts === 1) throw new Error('DB error');
      }
      return [];
    }),
  }));
};

// Mock MunicipalitiesRepository
const mockMunicipalitiesRepo = { data: [] };
vi.mock('@/repository/Municipalities.repository', () => ({
  __esModule: true,
  default: mockMunicipalitiesRepo,
}));

const mockStation = {
  IDEESS: 'ES001',
  'C.P.': '28001',
  Dirección: 'Test St',
  Horario: '24h',
  Latitud: '40',
  'Longitud (WGS84)': '-3',
  Localidad: 'Madrid',
  Margen: '1',
  Municipio: 'Madrid',
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
  'Precio Gasoleo A': '1.5',
  'Precio Gasoleo B': '',
  'Precio Gasoleo Premium': '',
  'Precio Gasolina 95 E10': '1.6',
  'Precio Gasolina 95 E25': '',
  'Precio Gasolina 95 E5': '',
  'Precio Gasolina 95 E5 Premium': '',
  'Precio Gasolina 95 E85': '',
  'Precio Gasolina 98 E10': '',
  'Precio Gasolina 98 E5': '',
  'Precio Gasolina Renovable': '',
  'Precio Hidrogeno': '',
  'Precio Metanol': '',
  Provincia: 'MADRID',
  Remisión: '',
  Rótulo: 'Test',
  'Tipo Venta': 'P',
  '% BioEtanol': '10',
  '% Éster metílico': '7',
  IDMunicipio: '28079',
  IDProvincia: '28',
  IDCCAA: '29',
};

const mockApiData = {
  ListaEESSPrecio: [mockStation],
  Fecha: '15/01/2024',
  Nota: '',
  ResultadoConsulta: 'OK',
};

describe('RealtimeDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRows = [];
    mockMunicipalitiesRepo.data = [];
  });

  afterEach(() => {
    delete process.env.REALTIME_DATA_CRON;
  });

  describe('loadStations', () => {
    it('fetches and saves station data successfully', async () => {
      mockGetStations.mockResolvedValue(mockApiData);
      seedDb();
      mockMap.mockReturnValue([{ stationId: 'ES001' }]);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadStations();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalledWith(fuelStationsTable);
      expect(mockDb.delete).toHaveBeenCalledWith(lastUpdatedTable);
      expect(insertedRows).toContainEqual({
        table: fuelStationsTable,
        values: [{ stationId: 'ES001', id: expect.stringMatching(/^test-uuid-/) }],
      });
      expect(insertedRows).toContainEqual({
        table: lastUpdatedTable,
        values: { lastUpdated: expect.any(String) },
      });
    });

    it('handles null response from API gracefully', async () => {
      mockGetStations.mockResolvedValue(null);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadStations();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(insertedRows).toHaveLength(0);
    });

    it('logs warning for duplicated IDs', async () => {
      const duplicatedApiData = {
        ...mockApiData,
        ListaEESSPrecio: [mockStation, { ...mockStation, IDEESS: 'ES001' }],
      };

      mockGetStations.mockResolvedValue(duplicatedApiData);
      seedDb();
      mockMap.mockReturnValue([{ stationId: 'ES001' }, { stationId: 'ES001' }]);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      const { logger } = await import('@/utils/logger');
      await realtimeDataService.loadStations();

      expect(logger.warn).toHaveBeenCalledWith('⚠️ Duplicated IDs found: ES001');
    });

    it('restores previous data when new insert fails', async () => {
      const previousLastUpdated = { lastUpdated: '2024-01-01T00:00:00.000Z' };

      mockGetStations.mockResolvedValue(mockApiData);
      seedDb({
        fuelStations: [{ stationId: 'ES001' }],
        lastUpdated: [previousLastUpdated],
        failFirstFuelInsert: true,
      });
      mockMap.mockReturnValue([{ stationId: 'ES001' }]);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadStations();

      // Should have tried the fuel insert twice (once for new, once for restore)
      const fuelInserts = insertedRows.filter((row) => row.table === fuelStationsTable);
      expect(fuelInserts).toHaveLength(2);
      expect(fuelInserts[0].values).toEqual([{ stationId: 'ES001', id: expect.any(String) }]);
      expect(fuelInserts[1].values).toEqual([{ stationId: 'ES001' }]);

      // the previous LastUpdated row was restored, no new stamp was written
      const lastUpdatedInserts = insertedRows.filter((row) => row.table === lastUpdatedTable);
      expect(lastUpdatedInserts).toEqual([{ table: lastUpdatedTable, values: previousLastUpdated }]);
    });
  });

  describe('loadMunicipalities', () => {
    it('fetches and saves municipality data successfully', async () => {
      const mockMunicipalities = [
        { IDMunicipio: '28079', IDProvincia: '28', IDCCAA: '29', Municipio: 'Madrid', Provincia: 'MADRID', CCAA: 'Madrid' },
      ];

      mockGetMunicipalities.mockResolvedValue(mockMunicipalities);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadMunicipalities();

      expect(mockGetMunicipalities).toHaveBeenCalled();
      expect(mockMunicipalitiesRepo.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ municipalityId: '28079', municipality: 'Madrid' }),
        ])
      );
    });

    it('handles null response from API gracefully', async () => {
      mockGetMunicipalities.mockResolvedValue(null);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadMunicipalities();

      expect(mockGetMunicipalities).toHaveBeenCalled();
      expect(mockMunicipalitiesRepo.data).toEqual([]);
    });

    it('transforms Spanish field names to camelCase', async () => {
      const mockMunicipalities = [
        { IDMunicipio: '01001', IDProvincia: '01', IDCCAA: '51', Municipio: 'Albacete', Provincia: 'ALBACETE', CCAA: 'CastillaLaMancha' },
      ];

      mockGetMunicipalities.mockResolvedValue(mockMunicipalities);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadMunicipalities();

      const saved = mockMunicipalitiesRepo.data[0];
      expect(saved).toHaveProperty('municipalityId');
      expect(saved).toHaveProperty('provinceId');
      expect(saved).toHaveProperty('regionId');
      expect(saved).toHaveProperty('municipality');
      expect(saved).toHaveProperty('province');
      expect(saved).toHaveProperty('region');
    });
  });

  describe('loadAll', () => {
    it('calls both loadStations and loadMunicipalities in parallel', async () => {
      mockGetStations.mockResolvedValue({
        ListaEESSPrecio: [],
        Fecha: '15/01/2024',
        Nota: '',
        ResultadoConsulta: 'OK',
      });
      mockGetMunicipalities.mockResolvedValue([]);
      seedDb();
      mockMap.mockReturnValue([]);

      const { realtimeDataService } = await import('@/services/realtime-data.service');
      await realtimeDataService.loadAll();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockGetMunicipalities).toHaveBeenCalled();
    });
  });

  describe('registerProgrammedTask', () => {
    it('registers a cron job with default schedule', async () => {
      const { realtimeDataService } = await import('@/services/realtime-data.service');
      realtimeDataService.registerProgrammedTask();

      expect(mockCronJobFrom).toHaveBeenCalledWith(
        expect.objectContaining({
          cronTime: '0,30 * * * *',
          start: true,
        })
      );
    });
  });
});
