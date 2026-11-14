import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { findCheapestFuelUseCase } from '@/application/usecases/StationQueries.usecase';
import { FUEL_FIELD_NAMES } from '@/infrastructure/persistence/fuel-fields';
import { logger } from '@/shared/utils/logger';

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
        const result = await findCheapestFuelUseCase({
          fuelType: args.fuelType,
          latitude: args.latitude,
          longitude: args.longitude,
          distanceKm: args.distanceKm,
          limit: args.limit,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
