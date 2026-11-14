import { Municipality } from '@/domain/entities/Municipality.model';
import type { IMunicipalitiesRepository } from '@/application/ports/repositories';

/** In-memory municipalities store (owned by the data layer, S1). */
let data: Municipality[] = [];

/**
 * Municipalities repository — owns the in-memory store.
 * Replaces the legacy `src/repository/Municipalities.repository.ts` singleton.
 */
class MunicipalitiesRepository implements IMunicipalitiesRepository {
  /** Legacy-compatible accessor (tests/seeds set `.data` directly). */
  get data(): Municipality[] {
    return data;
  }

  set data(value: Municipality[]) {
    data = value;
  }

  list(filters?: { province?: string; region?: string; search?: string }): Record<string, unknown>[] {
    let result: Record<string, unknown>[] = data as unknown as Record<string, unknown>[];
    if (!filters) return result;
    const { province, region, search } = filters;
    return result.filter((m) => {
      if (province && !String(m.province ?? '').toLowerCase().includes(province.toLowerCase())) return false;
      if (region && !String(m.region ?? '').toLowerCase().includes(region.toLowerCase())) return false;
      if (search) {
        const hay = `${String(m.municipality ?? '')} ${String(m.province ?? '')}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }

  replaceAll(next: Record<string, unknown>[]): void {
    data = next as unknown as Municipality[];
  }
}

export const municipalitiesRepository = new MunicipalitiesRepository();
export default municipalitiesRepository;
