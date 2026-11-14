import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { getDatabaseStatusUseCase } from '@/application/usecases/GetDatabaseStatus.usecase';

export function registerDatabaseInfoResource(server: McpServer, databaseService: DatabaseService): void {
  server.registerResource(
    'database-info',
    'fuelstations://info/status',
    {
      description: 'Current status of the databases: connection state, total station count, and last update timestamp.',
      mimeType: 'application/json',
    },
    async () => {
      const status = await getDatabaseStatusUseCase(databaseService);
      const legacy = {
        realtimeDatabase: {
          type: 'SQLite (in-memory)',
          status: status.realtimeDatabase.status,
          totalStations: status.realtimeDatabase.totalStations,
          lastUpdated: status.realtimeDatabase.lastUpdated,
        },
        historicDatabase: {
          type: 'PostgreSQL',
          status: status.historicDatabase.status,
        },
      };

      return {
        contents: [
          {
            uri: 'fuelstations://info/status',
            mimeType: 'application/json',
            text: JSON.stringify(legacy, null, 2),
          },
        ],
      };
    }
  );
}
