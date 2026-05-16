import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { logger } from '@/utils/logger/logger';

const MAX_LIMIT = 200;

export function queryFuelStationsTool(server: McpServer, _databaseService: DatabaseService): void {
  server.registerTool(
    'query_fuel_stations',
    {
      title: 'Query Fuel Stations',
      description:
        'Search for fuel stations in Spain by ID, municipality, province, or region. Returns current fuel prices and station information. Use limit and offset for pagination.',
      inputSchema: {
        ids: z.array(z.string()).optional().describe('Array of station IDs to lookup'),
        municipalityId: z.number().optional().describe('Filter by municipality ID'),
        provinceId: z.number().optional().describe('Filter by province ID'),
        regionId: z.number().optional().describe('Filter by autonomous community region ID'),
        limit: z.number().min(1).max(MAX_LIMIT).optional().describe(`Maximum number of results (1-${MAX_LIMIT}). Default: 30`),
        offset: z.number().min(0).optional().describe('Pagination offset. Default: 0'),
      },
    },
    async (args) => {
      try {
        const { ids, municipalityId, provinceId, regionId, limit, offset } = args;

        const where: Record<string, unknown> = {};
        if (ids) where.id = ids;
        if (municipalityId) where.municipalityId = municipalityId;
        if (provinceId) where.provinceId = provinceId;
        if (regionId) where.regionId = regionId;

        const { rows: stations, count } = await FuelStationsTable.findAndCountAll({
          where,
          limit: limit ?? 30,
          offset: offset ?? 0,
        });

        const results = stations.map((s) => s.get({ plain: true }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count, limit: limit ?? 30, offset: offset ?? 0, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error querying fuel stations', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error querying fuel stations: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
