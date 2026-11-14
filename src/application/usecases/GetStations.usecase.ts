import config from '@/shared/config/config.json';
import { calculateBoundingBox } from '@/shared/utils/calculate-distance';
import { createBadRequestError, createValidationError } from '@/shared/errors/error-handler';
import { stationRepository } from '@/infrastructure/persistence/StationRepository';

export interface GetStationsInput {
  limit?: number;
  offset?: number;
  municipalityId?: number;
  id?: string | string[];
  coordinates?: string;
  distance?: number;
}

/**
 * Stations query use case — owns pagination defaults, id/coords/municipality
 * filters, bounding-box math and the stationId→id presentation remap.
 * Moved verbatim from service-stations.controller.
 */
export async function getStationsUseCase(input: GetStationsInput) {
  if (input.distance && !input.coordinates) {
    throw createValidationError('If the distance parameter is defined, the coordinates parameter is also required');
  }

  let limit: number | undefined;
  let offset: number | undefined;

  // Truthy checks preserve the legacy controller semantics (limit=0,
  // municipalityId=0 and distance=0 are treated as absent).
  if (!input.id && !input.coordinates && !input.distance && !input.municipalityId) {
    limit = input.limit ? input.limit : config.defaults.query.limit;
    offset = input.offset ? input.offset : config.defaults.query.offset;

    if (offset >= limit) {
      throw createBadRequestError('Offset must be lower than limit');
    }

    limit = limit - offset > config.maximums.query.amount ? offset + config.maximums.query.amount : limit;
  }

  // Precedence (legacy): id overrides coordinates, coordinates override
  // municipalityId — each later filter replaced `where` in the controller.
  if (input.id) {
    const ids = Array.isArray(input.id) ? input.id : [input.id];
    const { rows, count } = await stationRepository.query({ ids });
    return present(rows, count);
  }

  if (input.coordinates) {
    const [latitude, longitude] = input.coordinates.split(',');
    let distance = input.distance ? input.distance : config.defaults.query.distance;
    distance = distance > config.maximums.query.distance ? config.maximums.query.distance : distance;
    distance = distance < config.minimums.query.distance ? config.minimums.query.distance : distance;
    const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(parseFloat(latitude), parseFloat(longitude), distance);
    const { rows, count } = await stationRepository.query({
      boundingBox: { minLat, maxLat, minLon, maxLon },
    });
    return present(rows, count);
  }

  if (input.municipalityId) {
    const { rows, count } = await stationRepository.query({
      municipalityId: input.municipalityId,
    });
    return present(rows, count);
  }

  const { rows, count } = await stationRepository.query({ limit, offset });
  return present(rows, count);
}

function present(rows: Record<string, unknown>[], count: number) {
  const mapped = rows.map((r) => ({ ...r, stationId: undefined, id: r.stationId }));
  return stationRepository.getLastUpdated().then((lastUpdated) => {
    // Preserve legacy behavior: an empty last_updated table threw TypeError
    // (lastUpdatedRows[0].lastUpdated) and surfaced as 500 via Sentry.
    if (lastUpdated === null || lastUpdated === undefined) {
      throw new Error('Cannot read properties of undefined (reading \'lastUpdated\')');
    }
    return {
      lastUpdated,
      count,
      results: mapped,
    };
  });
}
