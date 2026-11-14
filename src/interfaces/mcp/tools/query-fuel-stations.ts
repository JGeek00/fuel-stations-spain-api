import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { queryStationsUseCase } from '@/application/usecases/StationQueries.usecase';
import { logger } from '@/shared/utils/logger';

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
        const result = await queryStationsUseCase({
          ids: args.ids,
          municipalityId: args.municipalityId,
          provinceId: args.provinceId,
          regionId: args.regionId,
          limit: args.limit,
          offset: args.offset,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
