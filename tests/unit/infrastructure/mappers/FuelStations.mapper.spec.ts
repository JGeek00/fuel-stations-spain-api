import { describe, it, expect } from 'vitest';
import { FuelStationsMapper } from '@/infrastructure/mappers/FuelStations.mapper';
import type { ServiceStationsDto } from '@/infrastructure/providers/minetur/dto/ServiceStations.dto';

type StationDto = ServiceStationsDto['ListaEESSPrecio'][number];

const makeStation = (overrides: Partial<Record<string, string>> = {}): StationDto =>
  ({
    IDEESS: 'ES001',
    'C.P.': '28001',
    Dirección: 'Calle Test 1',
    Horario: 'L-D: 24H',
    Latitud: '40,4168',
    'Longitud (WGS84)': '-3,7038',
    Localidad: 'Madrid',
    Margen: 'L',
    Municipio: 'Madrid',
    Provincia: 'MADRID',
    Remisión: '',
    Rótulo: 'Test Station',
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
    'Precio Gasoleo A': '1,549',
    'Precio Gasoleo B': '',
    'Precio Gasoleo Premium': '',
    'Precio Gasolina 95 E10': '',
    'Precio Gasolina 95 E25': '',
    'Precio Gasolina 95 E5': '1,659',
    'Precio Gasolina 95 E5 Premium': '',
    'Precio Gasolina 95 E85': '',
    'Precio Gasolina 98 E10': '',
    'Precio Gasolina 98 E5': '',
    'Precio Gasolina Renovable': '',
    'Precio Hidrogeno': '',
    'Precio Metanol': '',
    ...overrides,
  }) as unknown as StationDto;

describe('FuelStationsMapper', () => {
  it('maps null input to an empty array', () => {
    expect(FuelStationsMapper.map(null as unknown as StationDto[])).toEqual([]);
  });

  it('maps undefined input to an empty array', () => {
    expect(FuelStationsMapper.map(undefined as unknown as StationDto[])).toEqual([]);
  });

  it('maps an empty list to an empty array', () => {
    expect(FuelStationsMapper.map([])).toEqual([]);
  });

  it('maps every field of a station DTO', () => {
    const [station] = FuelStationsMapper.map([makeStation()]);

    expect(station.stationId).toBe('ES001');
    expect(station.postalCode).toBe('28001');
    expect(station.address).toBe('Calle Test 1');
    expect(station.openingHours).toBe('L-D: 24H');
    expect(station.latitude).toBeCloseTo(40.4168);
    expect(station.longitude).toBeCloseTo(-3.7038);
    expect(station.locality).toBe('Madrid');
    expect(station.margin).toBe('L');
    expect(station.municipality).toBe('Madrid');
    expect(station.province).toBe('MADRID');
    expect(station.referral).toBe('');
    expect(station.signage).toBe('Test Station');
    expect(station.saleType).toBe('P');
    expect(station.percBioEthanol).toBe('10');
    expect(station.percMethylEster).toBe('7');
    expect(station.municipalityId).toBe(28079);
    expect(station.provinceId).toBe(28);
    expect(station.regionId).toBe(29);
    // Thousands dots removed, decimal comma normalized.
    expect(station.gasoilAPrice).toBeCloseTo(1.549);
    expect(station.gasoline95E5Price).toBeCloseTo(1.659);
  });

  it('maps empty price strings and missing ids to null', () => {
    const [station] = FuelStationsMapper.map([
      makeStation({
        IDMunicipio: '',
        IDProvincia: '',
        IDCCAA: '',
        'Precio Gasoleo A': '',
      }),
    ]);

    expect(station.municipalityId).toBeNull();
    expect(station.provinceId).toBeNull();
    expect(station.regionId).toBeNull();
    expect(station.gasoilAPrice).toBeNull();
  });

  it('maps several stations at once', () => {
    const stations = FuelStationsMapper.map([makeStation(), makeStation({ IDEESS: 'ES002' })]);

    expect(stations).toHaveLength(2);
    expect(stations[1].stationId).toBe('ES002');
  });
});
