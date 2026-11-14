import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { getStationInfoUseCase } from '@/application/usecases/StationQueries.usecase';
import { logger } from '@/shared/utils/logger';

export function getStationInfoTool(server: McpServer, _databaseService: DatabaseService): void {
  server.registerTool(
    'get_station_info',
    {
      title: 'Get Station Info',
      description:
        'Get complete details of a specific fuel station by its ID. Returns all available information including address, coordinates, opening hours, and all current fuel prices.',
      inputSchema: {
        stationId: z.string().describe('The unique ID of the fuel station'),
      },
    },
    async (args) => {
      try {
        const station = await getStationInfoUseCase(args.stationId);

        if (!station) {
          return {
            content: [{ type: 'text', text: `Station with ID "${args.stationId}" not found.` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(station, null, 2) }],
        };
      } catch (error) {
        logger.error('Error getting station info', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error getting station info: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
