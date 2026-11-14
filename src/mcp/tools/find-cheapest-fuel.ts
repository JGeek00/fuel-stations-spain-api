import { z } from 'zod';
import { and, asc, between, type SQL } from 'drizzle-orm';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { calculateBoundingBox } from '@/utils/calculate-distance';
import { fuelStationsTable, getMemoryDb } from '@/models/db/memory-db';
import { logger } from '@/utils/logger';

const FUEL_FIELD_NAMES = [
  'gasoilAPrice',
  'gasoilBPrice',
  'premiumGasoilPrice',
  'gasoline95E5Price',
  'gasoline95E5PremiumPrice',
  'gasoline95E10Price',
  'gasoline95E25Price',
  'gasoline95E85Price',
  'gasoline98E5Price',
  'gasoline98E10Price',
  'lpgPrice',
  'cngPrice',
  'lngPrice',
  'hydrogenPrice',
  'adbluePrice',
  'biodieselPrice',
  'bioethanolPrice',
  'compressedBiogasPrice',
  'liquefiedBiogasPrice',
  'renewableDieselPrice',
  'renewableGasolinePrice',
  'methanolPrice',
  'ammoniaPrice',
] as const;

type FuelField = (typeof FUEL_FIELD_NAMES)[number];

export function findCheapestFuelTool(server: McpServer, _databaseService: DatabaseService): void {
  server.registerTool(
    'find_cheapest_fuel',
    {
      title: 'Find Cheapest Fuel',
      description:
        'Find the N cheapest stations for a specific fuel type. Can search globally or within a geographic radius. Results sorted from cheapest to most expensive.',
      inputSchema: {
        fuelType: z.enum(FUEL_FIELD_NAMES).describe('The fuel price field to search'),
        latitude: z.number().min(-90).max(90).optional().describe('Center latitude for geographic search'),
        longitude: z.number().min(-180).max(180).optional().describe('Center longitude for geographic search'),
        distanceKm: z.number().min(10).max(50).optional().describe('Search radius in km (10-50). Required when coordinates are provided'),
        limit: z.number().min(1).max(200).optional().describe('Number of cheapest stations to return. Default: 10'),
      },
    },
    async (args) => {
      try {
        const { fuelType, latitude, longitude, distanceKm, limit } = args;
        const t = fuelStationsTable;
        const fuelColumn = (t as unknown as Record<string, typeof t.gasoilAPrice>)[fuelType];

        let where: SQL | undefined;

        if (latitude !== undefined && longitude !== undefined) {
          const distance = distanceKm ?? 30;
          const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(latitude, longitude, distance);
          where = and(
            between(t.latitude, minLat, maxLat),
            between(t.longitude, minLon, maxLon)
          );
        }

        // Only select relevant fields to reduce payload
        const stations = await getMemoryDb()
          .select({
            id: t.id,
            referral: t.referral,
            signage: t.signage,
            address: t.address,
            municipality: t.municipality,
            province: t.province,
            latitude: t.latitude,
            longitude: t.longitude,
            [fuelType]: fuelColumn,
          })
          .from(t)
          .where(where)
          .orderBy(asc(fuelColumn))
          .limit(limit ?? 10);

        const results = stations.map((station: Record<string, unknown>) => ({
          id: station.id,
          referral: station.referral,
          signage: station.signage,
          address: station.address,
          municipality: station.municipality,
          province: station.province,
          coordinates:
            station.latitude && station.longitude
              ? { latitude: station.latitude, longitude: station.longitude }
              : null,
          price: station[fuelType],
        }));

        const locationInfo =
          latitude !== undefined && longitude !== undefined
            ? { center: { latitude, longitude }, radiusKm: distanceKm ?? 30 }
            : { scope: 'national' };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ fuelType, ...locationInfo, count: results.length, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error finding cheapest fuel', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error finding cheapest fuel: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
