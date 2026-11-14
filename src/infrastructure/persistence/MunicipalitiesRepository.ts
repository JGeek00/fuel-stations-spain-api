import legacyMunicipalities from '@/repository/Municipalities.repository';
import type { IMunicipalitiesRepository } from '@/application/ports/repositories';

/**
 * Municipalities repository — wraps the legacy singleton store so existing
 * tests pinning `MunicipalitiesRepository.data` keep passing, while adding
 * the query methods controllers and MCP tools need.
 */
class MunicipalitiesRepository implements IMunicipalitiesRepository {
  list(filters?: { province?: string; region?: string; search?: string }): Record<string, unknown>[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = (legacyMunicipalities as any).data as Record<string, unknown>[];
    if (!filters) return data;
    const { province, region, search } = filters;
    return data.filter((m) => {
      if (province && !String((m as Record<string, unknown>).province ?? '').toLowerCase().includes(province.toLowerCase())) return false;
      if (region && !String((m as Record<string, unknown>).region ?? '').toLowerCase().includes(region.toLowerCase())) return false;
      if (search) {
        const hay = `${String((m as Record<string, unknown>).municipality ?? '')} ${String((m as Record<string, unknown>).province ?? '')}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }

  replaceAll(data: Record<string, unknown>[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (legacyMunicipalities as any).data = data;
  }
}

export const municipalitiesRepository = new MunicipalitiesRepository();
