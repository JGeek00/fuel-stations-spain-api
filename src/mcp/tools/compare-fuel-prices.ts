import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { FuelStation } from '@/models/entities/FuelStation.model';
import { FuelStationsTable } from '@/models/db/FuelStations';
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

export function compareFuelPricesTool(server: McpServer, _databaseService: DatabaseService): void {
  server.registerTool(
    'compare_fuel_prices',
    {
      title: 'Compare Fuel Prices',
      description:
        'Compare a specific fuel type price across multiple stations. Filter by station IDs, municipality, or get the cheapest options. Returns stations sorted by the selected fuel price (ascending).',
      inputSchema: {
        fuelType: z.enum(FUEL_FIELD_NAMES).describe('The fuel price field to compare'),
        ids: z.array(z.string()).optional().describe('Array of station IDs to compare'),
        municipalityId: z.number().optional().describe('Filter by municipality ID'),
        limit: z.number().min(1).max(200).optional().describe('Maximum number of results. Default: 50'),
      },
    },
    async (args) => {
      try {
        const { fuelType, ids, municipalityId, limit } = args;

        const where: Record<string, unknown> = {};
        if (ids) where.id = ids;
        if (municipalityId) where.municipalityId = municipalityId;

        // Only select relevant fields to reduce payload
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
        ] as unknown as (keyof FuelStation)[];

        const stations = await FuelStationsTable.findAll({
          where,
          attributes,
          order: [[fuelType, 'ASC']],
          limit: limit ?? 50,
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

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ fuelType, count: results.length, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error comparing fuel prices', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error comparing fuel prices: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
