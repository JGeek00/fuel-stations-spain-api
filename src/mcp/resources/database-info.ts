import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { FuelStation } from '@/models/FuelStation';
import { LastUpdated } from '@/models/LastUpdated';

export function registerDatabaseInfoResource(server: McpServer, databaseService: DatabaseService): void {
  server.registerResource(
    'database-info',
    'fuelstations://info/status',
    {
      description: 'Current status of the databases: connection state, total station count, and last update timestamp.',
      mimeType: 'application/json',
    },
    async () => {
      const stationCount = await FuelStation.count();
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
        contents: [
          {
            uri: 'fuelstations://info/status',
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }
  );
}
