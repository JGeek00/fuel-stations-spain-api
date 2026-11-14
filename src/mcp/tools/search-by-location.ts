import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { searchByLocationUseCase } from '@/application/usecases/StationQueries.usecase';
import { logger } from '@/utils/logger';

const MIN_DISTANCE = 10;
const MAX_DISTANCE = 50;

export function searchByLocationTool(server: McpServer, _databaseService: DatabaseService): void {
  server.registerTool(
    'search_stations_by_location',
    {
      title: 'Search Stations by Location',
      description:
        'Find fuel stations within a geographic radius. Provides the center coordinates (latitude, longitude) and a distance in kilometers (10-50 km). Returns all stations inside the search area with their current fuel prices.',
      inputSchema: {
        latitude: z.number().min(-90).max(90).describe('Center latitude (-90 to 90)'),
        longitude: z.number().min(-180).max(180).describe('Center longitude (-180 to 180)'),
        distanceKm: z.number().min(MIN_DISTANCE).max(MAX_DISTANCE).optional().describe(`Search radius in km (${MIN_DISTANCE}-${MAX_DISTANCE}). Default: 30`),
      },
    },
    async (args) => {
      try {
        const result = await searchByLocationUseCase(args.latitude, args.longitude, args.distanceKm ?? 30);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        logger.error('Error searching by location', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error searching by location: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
