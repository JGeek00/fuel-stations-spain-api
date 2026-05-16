import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Municipality } from '../../models/entities';

describe('MunicipalitiesRepository', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('singleton pattern', () => {
    it('returns the same instance on every import', async () => {
      const { default: firstImport } = await import('../Municipalities.repository');
      const { default: secondImport } = await import('../Municipalities.repository');

      expect(firstImport).toBe(secondImport);
    });
  });

  describe('data initialization', () => {
    it('initializes data as an empty array', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      expect(municipalitiesRepo.data).toEqual([]);
      expect(Array.isArray(municipalitiesRepo.data)).toBe(true);
    });

    it('data is a mutable array', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      const municipality: Municipality = {
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      };

      municipalitiesRepo.data.push(municipality);
      expect(municipalitiesRepo.data).toHaveLength(1);
      expect(municipalitiesRepo.data[0]).toEqual(municipality);
    });
  });

  describe('data operations', () => {
    it('allows adding multiple municipalities', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

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

      municipalitiesRepo.data.push(...municipalities);
      expect(municipalitiesRepo.data).toHaveLength(2);
    });

    it('allows clearing all data', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      municipalitiesRepo.data.push({
        municipalityId: '01',
        provinceId: '01',
        regionId: '01',
        municipality: 'Madrid',
        province: 'Madrid',
        region: 'Comunidad de Madrid',
      });

      municipalitiesRepo.data = [];
      expect(municipalitiesRepo.data).toEqual([]);
    });

    it('allows replacing data entirely', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

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

      municipalitiesRepo.data = newMunicipalities;
      expect(municipalitiesRepo.data).toEqual(newMunicipalities);
    });

    it('supports filtering by province', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      municipalitiesRepo.data = [
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

      const filtered = municipalitiesRepo.data.filter(
        (m) => m.province.toLowerCase() === 'madrid'
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Madrid');
    });

    it('supports filtering by region', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      municipalitiesRepo.data = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '29',
          provinceId: '29',
          regionId: '29',
          municipality: 'Granada',
          province: 'Granada',
          region: 'Andalucía',
        },
      ];

      const filtered = municipalitiesRepo.data.filter(
        (m) => m.region.toLowerCase().includes('andalucía')
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Granada');
    });

    it('supports partial text search on municipality name', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      municipalitiesRepo.data = [
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

      const filtered = municipalitiesRepo.data.filter(
        (m) => m.municipality.toLowerCase().includes('alcalá')
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].municipality).toBe('Alcalá de Henares');
    });
  });

  describe('Municipality schema', () => {
    it('data items conform to the Municipality interface', async () => {
      const repo = await import('../Municipalities.repository');
      const municipalitiesRepo = repo.default;

      const municipality: Municipality = {
        municipalityId: '08',
        provinceId: '08',
        regionId: '08',
        municipality: 'Barcelona',
        province: 'Barcelona',
        region: 'Cataluña',
      };

      municipalitiesRepo.data.push(municipality);

      const item = municipalitiesRepo.data[0];
      expect(item).toHaveProperty('municipalityId');
      expect(item).toHaveProperty('provinceId');
      expect(item).toHaveProperty('regionId');
      expect(item).toHaveProperty('municipality');
      expect(item).toHaveProperty('province');
      expect(item).toHaveProperty('region');
    });
  });
});
