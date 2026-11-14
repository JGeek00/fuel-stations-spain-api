import { z } from 'zod';
import { DateTime } from 'luxon';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';
import { keysToCamel } from '@/shared/utils/case-keys';
import { logger } from '@/shared/utils/logger';

export function queryHistoricPricesTool(server: McpServer, databaseService: DatabaseService): void {
  server.registerTool(
    'query_historic_prices',
    {
      title: 'Query Historic Prices',
      description:
        'Query historical fuel prices for a specific station over a date range. Returns a time series of prices sorted chronologically. Maximum date range is 1 year. Optionally includes current prices.',
      inputSchema: {
        stationId: z.string().describe('The unique ID of the fuel station'),
        startDate: z.string().describe('Start date in yyyy-mm-dd format'),
        endDate: z.string().describe('End date in yyyy-mm-dd format'),
        includeCurrentPrices: z.boolean().optional().describe('Include current day prices in results. Default: false'),
      },
    },
    async (args) => {
      try {
        const { stationId, startDate, endDate, includeCurrentPrices } = args;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let start: DateTime, end: DateTime;
        try {
          start = DateTime.fromSQL(startDate).setZone(timezone);
          end = DateTime.fromSQL(endDate).setZone(timezone);
        } catch {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Use yyyy-mm-dd.' }],
            isError: true,
          };
        }

        if (start > end) {
          return {
            content: [{ type: 'text', text: 'startDate must be earlier than endDate.' }],
            isError: true,
          };
        }

        const diffYears = end.diff(start, 'years').years;
        if (diffYears > 1) {
          return {
            content: [{ type: 'text', text: 'Maximum date range is 1 year.' }],
            isError: true,
          };
        }

        try {
          databaseService.persistedDbInstance;
        } catch {
          return {
            content: [{ type: 'text', text: 'Historic data is not available. PostgreSQL database is not configured.' }],
            isError: true,
          };
        }

        const historicResult = await historicRepository.queryRange(
          stationId,
          start.toSQLDate() as string,
          end.toSQLDate() as string,
        );
        const formattedHistoric = historicResult.map((e: Record<string, unknown>) => keysToCamel(e));

        let currentPrices: Record<string, unknown> | null = null;
        if (includeCurrentPrices) {
          const current = await historicRepository.queryCurrent(stationId);
          if (current) {
            const values = keysToCamel(current);
            currentPrices = {
              ...values,
              stationId: values.id ?? null,
              stationSignage: values.signage ?? null,
              date: DateTime.now().toSQLDate(),
            };
          }
        }

        const results = currentPrices ? [...formattedHistoric, currentPrices] : formattedHistoric;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ stationId, startDate, endDate, count: results.length, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error querying historic prices', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error querying historic prices: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
