import { z } from 'zod';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
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
        const t = fuelStationsTable;
        const fuelColumn = (t as unknown as Record<string, typeof t.gasoilAPrice>)[fuelType];

        const conditions: SQL[] = [];
        if (ids) conditions.push(inArray(t.id, ids));
        if (municipalityId) conditions.push(eq(t.municipalityId, municipalityId));
        const where = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;

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
          .limit(limit ?? 50);

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
