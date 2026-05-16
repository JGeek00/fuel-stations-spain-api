import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { twoDigits } from '../../utils';
import { API_BASE_URL } from '../../config/constants';

vi.mock('@/utils', () => ({
  logger: {
    error: vi.fn(),
  },
  twoDigits: (n: number) => String(n).padStart(2, '0'),
}));

vi.mock('@/utils/numbers/numbers', () => ({
  twoDigits: (n: number) => String(n).padStart(2, '0'),
}));

vi.mock('typia', () => ({
  default: {
    assert: vi.fn((v) => v),
  },
}));

const originalFetch = global.fetch;

describe('DataProviderApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getStations', () => {
    it('returns parsed data on successful response', async () => {
      const mockData = {
        Fecha: '15/01/2024 10:00:00',
        ListaEESSPrecio: [
          {
            IDEESS: 'ES000123',
            'C.P.': '28001',
            Dirección: 'Calle Test 1',
            Horario: '24h',
            Latitud: '40.4168',
            'Longitud (WGS84)': '-3.7038',
            Localidad: 'Madrid',
            Margen: '1.5',
            Municipio: 'Madrid',
            'Precio Adblue': '0.85',
            'Precio Amoniaco': '',
            'Precio Biodiesel': '',
            'Precio Bioetanol': '',
            'Precio Biogas Natural Comprimido': '',
            'Precio Biogas Natural Licuado': '',
            'Precio Diésel Renovable': '',
            'Precio Gas Natural Comprimido': '',
            'Precio Gas Natural Licuado': '',
            'Precio Gases licuados del petróleo': '',
            'Precio Gasoleo A': '1.500',
            'Precio Gasoleo B': '',
            'Precio Gasoleo Premium': '1.700',
            'Precio Gasolina 95 E10': '1.600',
            'Precio Gasolina 95 E25': '',
            'Precio Gasolina 95 E5': '1.650',
            'Precio Gasolina 95 E5 Premium': '',
            'Precio Gasolina 95 E85': '',
            'Precio Gasolina 98 E10': '',
            'Precio Gasolina 98 E5': '',
            'Precio Gasolina Renovable': '',
            'Precio Hidrogeno': '',
            'Precio Metanol': '',
            Provincia: 'MADRID',
            Remisión: '',
            Rótulo: 'Repso',
            'Tipo Venta': 'P',
            '% BioEtanol': '10',
            '% Éster metílico': '7',
            IDMunicipio: '28079',
            IDProvincia: '28',
            IDCCAA: '29',
          },
        ],
        Nota: '',
        ResultadoConsulta: 'OK',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
        statusText: 'OK',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getStations();

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/EstacionesTerrestres/`, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockData);
    });

    it('returns null on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getStations();

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getStations();

      expect(result).toBeNull();
    });
  });

  describe('getStationsHistoric', () => {
    it('returns parsed data on successful response', async () => {
      const date = DateTime.fromObject({ year: 2024, month: 1, day: 15 });
      const mockData = {
        Fecha: '15/01/2024 10:00:00',
        ListaEESSPrecio: [],
        Nota: '',
        ResultadoConsulta: 'OK',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
        statusText: 'OK',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getStationsHistoric(date);

      const expectedUrl = `${API_BASE_URL}/EstacionesTerrestresHist/${twoDigits(date.get('day'))}-${twoDigits(date.get('month'))}-${twoDigits(date.get('year'))}`;
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockData);
    });

    it('formats date correctly with twoDigits', async () => {
      const date = DateTime.fromObject({ year: 2024, month: 1, day: 5 });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Fecha: '05/01/2024 10:00:00',
          ListaEESSPrecio: [],
          Nota: '',
          ResultadoConsulta: 'OK',
        }),
        status: 200,
        statusText: 'OK',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      await DataProviderApiService.getStationsHistoric(date);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/EstacionesTerrestresHist/05-01-2024`,
        expect.any(Object)
      );
    });

    it('returns null on HTTP error', async () => {
      const date = DateTime.fromObject({ year: 2024, month: 1, day: 15 });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getStationsHistoric(date);

      expect(result).toBeNull();
    });
  });

  describe('getMunicipalities', () => {
    it('returns parsed data on successful response', async () => {
      const mockData = [
        {
          IDMunicipio: '28079',
          IDProvincia: '28',
          IDCCAA: '29',
          Municipio: 'Madrid',
          Provincia: 'MADRID',
          CCAA: 'Madrid',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
        statusText: 'OK',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getMunicipalities();

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/Listados/Municipios`, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockData);
    });

    it('returns null on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getMunicipalities();

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const { DataProviderApiService } = await import('../data-provider-api.service');
      const result = await DataProviderApiService.getMunicipalities();

      expect(result).toBeNull();
    });
  });
});
