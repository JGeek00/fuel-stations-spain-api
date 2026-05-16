import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/utils', () => ({
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
vi.mock('@/services/data-provider-api/data-provider-api.service', () => ({
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

// Mock LastUpdated model
const mockLastUpdatedFindAll = vi.fn();
const mockLastUpdatedTruncate = vi.fn();
const mockLastUpdatedCreate = vi.fn();
vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: {
    findAll: mockLastUpdatedFindAll,
    truncate: mockLastUpdatedTruncate,
    create: mockLastUpdatedCreate,
  },
}));

// Mock FuelStationsTable
const mockFuelStationsFindAll = vi.fn();
const mockFuelStationsTruncate = vi.fn();
const mockFuelStationsBulkCreate = vi.fn();
vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findAll: mockFuelStationsFindAll,
    truncate: mockFuelStationsTruncate,
    bulkCreate: mockFuelStationsBulkCreate,
  },
}));

// Mock MunicipalitiesRepository
const mockMunicipalitiesRepo = { data: [] };
vi.mock('@/repository/Municipalities/Municipalities.repository', () => ({
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
    mockMunicipalitiesRepo.data = [];
  });

  afterEach(() => {
    delete process.env.REALTIME_DATA_CRON;
  });

  describe('loadStations', () => {
    it('fetches and saves station data successfully', async () => {
      mockGetStations.mockResolvedValue(mockApiData);
      mockFuelStationsFindAll.mockResolvedValue([]);
      mockLastUpdatedFindAll.mockResolvedValue([]);
      mockFuelStationsTruncate.mockResolvedValue(undefined);
      mockLastUpdatedTruncate.mockResolvedValue(undefined);
      mockFuelStationsBulkCreate.mockResolvedValue([]);
      mockLastUpdatedCreate.mockResolvedValue({});
      mockMap.mockReturnValue([{ stationId: 'ES001' }]);

      const { realtimeDataService } = await import('./realtime-data.service');
      await realtimeDataService.loadStations();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockFuelStationsTruncate).toHaveBeenCalled();
      expect(mockLastUpdatedTruncate).toHaveBeenCalled();
      expect(mockFuelStationsBulkCreate).toHaveBeenCalled();
      expect(mockLastUpdatedCreate).toHaveBeenCalled();
    });

    it('handles null response from API gracefully', async () => {
      mockGetStations.mockResolvedValue(null);

      const { realtimeDataService } = await import('./realtime-data.service');
      await realtimeDataService.loadStations();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockFuelStationsTruncate).not.toHaveBeenCalled();
    });

    it('logs warning for duplicated IDs', async () => {
      const duplicatedApiData = {
        ...mockApiData,
        ListaEESSPrecio: [mockStation, { ...mockStation, IDEESS: 'ES001' }],
      };

      mockGetStations.mockResolvedValue(duplicatedApiData);
      mockFuelStationsFindAll.mockResolvedValue([]);
      mockLastUpdatedFindAll.mockResolvedValue([]);
      mockFuelStationsTruncate.mockResolvedValue(undefined);
      mockLastUpdatedTruncate.mockResolvedValue(undefined);
      mockFuelStationsBulkCreate.mockResolvedValue([]);
      mockLastUpdatedCreate.mockResolvedValue({});
      mockMap.mockReturnValue([{ stationId: 'ES001' }, { stationId: 'ES001' }]);

      const { realtimeDataService } = await import('./realtime-data.service');
      const { logger } = await import('../../utils');
      await realtimeDataService.loadStations();

      expect(logger.warn).toHaveBeenCalledWith('⚠️ Duplicated IDs found: ES001');
    });

    it('restores previous data when new insert fails', async () => {
      const previousStation = {
        get: vi.fn(() => ({ stationId: 'ES001' })),
      };
      const previousLastUpdated = {
        get: vi.fn(() => ({ lastUpdated: new Date() })),
      };

      mockGetStations.mockResolvedValue(mockApiData);
      mockFuelStationsFindAll.mockResolvedValue([previousStation]);
      mockLastUpdatedFindAll.mockResolvedValue([previousLastUpdated]);
      mockFuelStationsTruncate.mockResolvedValue(undefined);
      mockLastUpdatedTruncate.mockResolvedValue(undefined);
      mockFuelStationsBulkCreate.mockRejectedValueOnce(new Error('DB error'));
      mockLastUpdatedCreate.mockResolvedValue({});
      mockMap.mockReturnValue([{ stationId: 'ES001' }]);

      const { realtimeDataService } = await import('./realtime-data.service');
      await realtimeDataService.loadStations();

      // Should have tried bulkCreate twice (once for new, once for restore)
      expect(mockFuelStationsBulkCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadMunicipalities', () => {
    it('fetches and saves municipality data successfully', async () => {
      const mockMunicipalities = [
        { IDMunicipio: '28079', IDProvincia: '28', IDCCAA: '29', Municipio: 'Madrid', Provincia: 'MADRID', CCAA: 'Madrid' },
      ];

      mockGetMunicipalities.mockResolvedValue(mockMunicipalities);

      const { realtimeDataService } = await import('./realtime-data.service');
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

      const { realtimeDataService } = await import('./realtime-data.service');
      await realtimeDataService.loadMunicipalities();

      expect(mockGetMunicipalities).toHaveBeenCalled();
      expect(mockMunicipalitiesRepo.data).toEqual([]);
    });

    it('transforms Spanish field names to camelCase', async () => {
      const mockMunicipalities = [
        { IDMunicipio: '01001', IDProvincia: '01', IDCCAA: '51', Municipio: 'Albacete', Provincia: 'ALBACETE', CCAA: 'CastillaLaMancha' },
      ];

      mockGetMunicipalities.mockResolvedValue(mockMunicipalities);

      const { realtimeDataService } = await import('./realtime-data.service');
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
      mockFuelStationsFindAll.mockResolvedValue([]);
      mockLastUpdatedFindAll.mockResolvedValue([]);
      mockFuelStationsTruncate.mockResolvedValue(undefined);
      mockLastUpdatedTruncate.mockResolvedValue(undefined);
      mockFuelStationsBulkCreate.mockResolvedValue([]);
      mockLastUpdatedCreate.mockResolvedValue({});
      mockMap.mockReturnValue([]);

      const { realtimeDataService } = await import('./realtime-data.service');
      await realtimeDataService.loadAll();

      expect(mockGetStations).toHaveBeenCalled();
      expect(mockGetMunicipalities).toHaveBeenCalled();
    });
  });

  describe('registerProgrammedTask', () => {
    it('registers a cron job with default schedule', async () => {
      const { realtimeDataService } = await import('./realtime-data.service');
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
