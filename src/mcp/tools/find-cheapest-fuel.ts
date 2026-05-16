import { z } from 'zod';
import { Op } from 'sequelize';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database/database.service';
import { calculateBoundingBox } from '@/utils/calculate-distance/calculate-distance';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { FuelStation } from '@/models/entities/FuelStation.model';
import { logger } from '@/utils/logger/logger';

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

        const where: Record<string, unknown> = {};

        if (latitude !== undefined && longitude !== undefined) {
          const distance = distanceKm ?? 30;
          const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(latitude, longitude, distance);
          where.latitude = { [Op.between]: [minLat, maxLat] };
          where.longitude = { [Op.between]: [minLon, maxLon] };
        }

        const attributes: (keyof FuelStation)[] = [
          'id',
          'referral',
          'signage',
          'address',
          'municipality',
          'province',
          'latitude',
          'longitude',
          fuelType as FuelField,
        ] as (keyof FuelStation)[];

        const stations = await FuelStationsTable.findAll({
          where,
          attributes,
          order: [[fuelType, 'ASC']],
          limit: limit ?? 10,
        });

        const results = stations.map((s) => {
          const data = s.get({ plain: true }) as unknown as Record<string, unknown>;
          return {
            id: data.id,
            referral: data.referral,
            signage: data.signage,
            address: data.address,
            municipality: data.municipality,
            province: data.province,
            coordinates:
              data.latitude && data.longitude ? { latitude: data.latitude, longitude: data.longitude } : null,
            price: data[fuelType],
          };
        });

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
