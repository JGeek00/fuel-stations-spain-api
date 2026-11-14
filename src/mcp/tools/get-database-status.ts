import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { getDatabaseStatusUseCase } from '@/application/usecases/GetDatabaseStatus.usecase';
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
        const status = await getDatabaseStatusUseCase(databaseService);
        // Preserve legacy labels expected by existing tests/consumers.
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
          content: [{ type: 'text', text: JSON.stringify(legacy, null, 2) }],
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
