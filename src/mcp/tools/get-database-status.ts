import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { LastUpdated } from '@/models/db/LastUpdated';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { logger } from '@/utils/logger';

export function getDatabaseStatusTool(server: McpServer, databaseService: DatabaseService): void {
  server.registerTool(
    'get_database_status',
    {
      title: 'Get Database Status',
      description:
        'Check the status of both databases (SQLite realtime and PostgreSQL historic). Returns the last update timestamp, total station count, and PostgreSQL connectivity status.',
    },
    async () => {
      try {
        const stationCount = await FuelStationsTable.count();
        const lastUpdated = await LastUpdated.findOne();

        let postgresConnected = false;
        try {
          await databaseService.persistedDbInstance.authenticate();
          postgresConnected = true;
        } catch {
          postgresConnected = false;
        }

        const status = {
          realtimeDatabase: {
            type: 'SQLite (in-memory)',
            status: 'connected',
            totalStations: stationCount,
            lastUpdated: lastUpdated ? lastUpdated.getDataValue('lastUpdated') : null,
          },
          historicDatabase: {
            type: 'PostgreSQL',
            status: postgresConnected ? 'connected' : 'disconnected',
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting database status', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error getting database status: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
