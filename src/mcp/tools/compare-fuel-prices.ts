import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { compareFuelPricesUseCase } from '@/application/usecases/StationQueries.usecase';
import { FUEL_FIELD_NAMES } from '@/infrastructure/persistence/fuel-fields';
import { logger } from '@/utils/logger';

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
        const result = await compareFuelPricesUseCase({
          fuelType: args.fuelType,
          ids: args.ids,
          municipalityId: args.municipalityId,
          limit: args.limit,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
