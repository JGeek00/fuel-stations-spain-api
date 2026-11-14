import { describe, it, expect, vi, beforeEach } from 'vitest';
import { municipalitiesRepository } from '@/infrastructure/persistence/MunicipalitiesRepository';
import { Municipality } from '@/domain/entities';

describe('MunicipalitiesRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    municipalitiesRepository.data = [];
  });

  describe('singleton pattern', () => {
    it('returns the same instance on every import', async () => {
      const firstImport = await import('@/infrastructure/persistence/MunicipalitiesRepository');
      const secondImport = await import('@/infrastructure/persistence/MunicipalitiesRepository');

      expect(firstImport.municipalitiesRepository).toBe(secondImport.municipalitiesRepository);
      expect(firstImport.default).toBe(secondImport.default);
    });
  });

  describe('data initialization', () => {
    it('initializes data as an empty array', () => {
      expect(municipalitiesRepository.data).toEqual([]);
      expect(Array.isArray(municipalitiesRepository.data)).toBe(true);
    });

    it('data is a mutable array', () => {
      const municipality: Municipality = {
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      };

      municipalitiesRepository.data.push(municipality);
      expect(municipalitiesRepository.data).toHaveLength(1);
      expect(municipalitiesRepository.data[0]).toEqual(municipality);
    });
  });

  describe('data operations', () => {
    it('allows adding multiple municipalities', () => {
      const municipalities: Municipality[] = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '02',
          provinceId: '08',
          regionId: '08',
          municipality: 'Barcelona',
          province: 'Barcelona',
          region: 'Cataluña',
        },
      ];

      municipalitiesRepository.data.push(...municipalities);
      expect(municipalitiesRepository.data).toHaveLength(2);
    });

    it('allows clearing all data', () => {
      municipalitiesRepository.data.push({
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      });

      municipalitiesRepository.data = [];
      expect(municipalitiesRepository.data).toEqual([]);
    });

    it('allows replacing data entirely', () => {
      const newMunicipalities: Municipality[] = [
        {
          municipalityId: '29',
          provinceId: '29',
          regionId: '29',
          municipality: 'Granada',
          province: 'Granada',
          region: 'Andalucía',
        },
      ];

      municipalitiesRepository.data = newMunicipalities;
      expect(municipalitiesRepository.data).toEqual(newMunicipalities);
    });

    it('replaceAll replaces the whole store', () => {
      municipalitiesRepository.data.push({
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      });

      const next: Municipality[] = [
        {
          municipalityId: '29',
          provinceId: '29',
          regionId: '29',
          municipality: 'Granada',
          province: 'Granada',
          region: 'Andalucía',
        },
      ];
      municipalitiesRepository.replaceAll(next as unknown as Record<string, unknown>[]);

      expect(municipalitiesRepository.data).toEqual(next);
      expect(municipalitiesRepository.list()).toHaveLength(1);
      expect(municipalitiesRepository.list()[0].municipality).toBe('Granada');
    });
  });

  describe('list filtering', () => {
    const seed: Municipality[] = [
      {
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      },
      {
        municipalityId: '02',
        provinceId: '08',
        regionId: '08',
        municipality: 'Barcelona',
        province: 'Barcelona',
        region: 'Cataluña',
      },
      {
        municipalityId: '03',
        provinceId: '41',
        regionId: '51',
        municipality: 'Sevilla',
        province: 'Sevilla',
        region: 'Andalucía',
      },
    ];

    it('returns all data when no filters are given', () => {
      municipalitiesRepository.data = seed;
      expect(municipalitiesRepository.list()).toHaveLength(3);
    });

    it('filters by province (case-insensitive)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ province: 'madrid' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Madrid');
    });

    it('filters by region (case-insensitive)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ region: 'andalucía' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Sevilla');
    });

    it('filters by partial text search on municipality and province', () => {
      municipalitiesRepository.data = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '02',
          provinceId: '28',
          regionId: '28',
          municipality: 'Alcalá de Henares',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
      ];

      const filtered = municipalitiesRepository.list({ search: 'alcalá' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Alcalá de Henares');
    });

    it('combines province and region filters', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ province: 'Barcelona', region: 'Cataluña' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Barcelona');
    });

    it('returns an empty array when nothing matches', () => {
      municipalitiesRepository.data = seed;
      expect(municipalitiesRepository.list({ search: 'ZooCity' })).toEqual([]);
    });

    it('applies no filter when the filters object is empty', () => {
      municipalitiesRepository.data = seed;
      expect(municipalitiesRepository.list({})).toHaveLength(3);
    });

    it('filters by province alone (region and search absent)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ province: 'Barcelona' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Barcelona');
    });

    it('filters by region alone (province and search absent)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ region: 'Cataluña' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Barcelona');
    });

    it('filters by search alone (province and region absent)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ search: 'sevilla' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Sevilla');
    });

    it('search matches the province part of the haystack', () => {
      municipalitiesRepository.data = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'ZooCity',
          province: 'Sevilla',
          region: 'Andalucía',
        },
      ];
      // Only the province part of the haystack contains the search term.
      const filtered = municipalitiesRepository.list({ search: 'sevi' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('ZooCity');
    });

    it('combines province and search filters (search rejects non-matching rows)', () => {
      municipalitiesRepository.data = seed;
      const filtered = municipalitiesRepository.list({ province: 'madrid', search: 'barcelona' });
      expect(filtered).toEqual([]);
    });

    it('tolerates rows with missing municipality/province/region fields', () => {
      municipalitiesRepository.data = [
        { municipality: 'A', province: 'Madrid' } as unknown as Municipality, // no region
        { municipality: 'Madrid' } as unknown as Municipality, // no province, no region
        { province: 'Madrid' } as unknown as Municipality, // no municipality
      ];

      // Province filter passes but the nullish region falls back to '' and rejects the row.
      expect(municipalitiesRepository.list({ province: 'madrid', region: 'y' })).toEqual([]);
      // Search runs over rows missing municipality (row 3) and province (row 2);
      // all three match through whichever haystack part exists.
      expect(municipalitiesRepository.list({ search: 'madrid' })).toHaveLength(3);
    });
  });

  describe('Municipality schema', () => {
    it('data items conform to the Municipality interface', () => {
      const municipality: Municipality = {
        municipalityId: '08',
        provinceId: '08',
        regionId: '08',
        municipality: 'Barcelona',
        province: 'Barcelona',
        region: 'Cataluña',
      };

      municipalitiesRepository.data.push(municipality);

      const item = municipalitiesRepository.data[0];
      expect(item).toHaveProperty('municipalityId');
      expect(item).toHaveProperty('provinceId');
      expect(item).toHaveProperty('regionId');
      expect(item).toHaveProperty('municipality');
      expect(item).toHaveProperty('province');
      expect(item).toHaveProperty('region');
    });
  });
});
