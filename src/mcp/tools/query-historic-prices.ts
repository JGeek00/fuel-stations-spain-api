import { z } from 'zod';
import { DateTime } from 'luxon';
import { and, asc, between, eq } from 'drizzle-orm';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database.service';
import { fuelStationsTable, getMemoryDb, historicFuelStationsTable } from '@/models/db/memory-db';
import { keysToCamel } from '@/utils/case-keys';
import { logger } from '@/utils/logger';

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

        // Validate dates
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

        // Check persisted DB is available
        try {
          databaseService.persistedDbInstance;
        } catch {
          return {
            content: [{ type: 'text', text: 'Historic data is not available. PostgreSQL database is not configured.' }],
            isError: true,
          };
        }

        const h = historicFuelStationsTable;
        const historicResult = await getMemoryDb()
          .select({
            stationId: h.stationId,
            stationSignage: h.stationSignage,
            adbluePrice: h.adbluePrice,
            ammoniaPrice: h.ammoniaPrice,
            biodieselPrice: h.biodieselPrice,
            bioethanolPrice: h.bioethanolPrice,
            compressedBiogasPrice: h.compressedBiogasPrice,
            liquefiedBiogasPrice: h.liquefiedBiogasPrice,
            renewableDieselPrice: h.renewableDieselPrice,
            cngPrice: h.cngPrice,
            lngPrice: h.lngPrice,
            lpgPrice: h.lpgPrice,
            gasoilAPrice: h.gasoilAPrice,
            gasoilBPrice: h.gasoilBPrice,
            premiumGasoilPrice: h.premiumGasoilPrice,
            gasoline95E10Price: h.gasoline95E10Price,
            gasoline95E25Price: h.gasoline95E25Price,
            gasoline95E5Price: h.gasoline95E5Price,
            gasoline95E5PremiumPrice: h.gasoline95E5PremiumPrice,
            gasoline95E85Price: h.gasoline95E85Price,
            gasoline98E10Price: h.gasoline98E10Price,
            gasoline98E5Price: h.gasoline98E5Price,
            renewableGasolinePrice: h.renewableGasolinePrice,
            hydrogenPrice: h.hydrogenPrice,
            methanolPrice: h.methanolPrice,
            date: h.date,
          })
          .from(h)
          .where(and(
            eq(h.stationId, stationId),
            between(h.date, start.toSQLDate() as string, end.toSQLDate() as string)
          ))
          .orderBy(asc(h.date));

        const formattedHistoric = historicResult.map((e: Record<string, unknown>) => keysToCamel(e));

        let currentPrices: Record<string, unknown> | null = null;
        if (includeCurrentPrices) {
          const currentRows = await getMemoryDb()
            .select()
            .from(fuelStationsTable)
            .where(eq(fuelStationsTable.stationId, stationId))
            .limit(1);
          if (currentRows[0]) {
            const values = keysToCamel(currentRows[0]);
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
