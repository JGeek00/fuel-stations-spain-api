import { municipalitiesRepository } from '@/infrastructure/persistence/MunicipalitiesRepository';

/** Lists municipalities — thin wrapper so REST and MCP share filtering. */
export function listMunicipalitiesUseCase(filters?: { province?: string; region?: string; search?: string }) {
  const municipalities = municipalitiesRepository.list(filters);
  return { municipalities };
}
