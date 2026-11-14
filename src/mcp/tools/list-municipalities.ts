import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type municipalitiesRepository from '@/infrastructure/persistence/MunicipalitiesRepository';
import { listMunicipalitiesUseCase } from '@/application/usecases/ListMunicipalities.usecase';
import { logger } from '@/utils/logger';

export function listMunicipalitiesTool(server: McpServer, _municipalitiesRepository: typeof municipalitiesRepository): void {
  server.registerTool(
    'list_municipalities',
    {
      title: 'List Municipalities',
      description:
        'List Spanish municipalities with optional filters for province, region, or text search. Returns municipality IDs, names, province, and autonomous community (region).',
      inputSchema: {
        province: z.string().optional().describe('Filter by province name'),
        region: z.string().optional().describe('Filter by autonomous community (region) name'),
        search: z.string().optional().describe('Search by municipality name (partial match)'),
      },
    },
    async (args) => {
      try {
        const result = listMunicipalitiesUseCase({
          province: args.province,
          region: args.region,
          search: args.search,
        });
        const municipalities = result.municipalities;
        return {
          content: [{ type: 'text', text: JSON.stringify({ count: municipalities.length, municipalities }, null, 2) }],
        };
      } catch (error) {
        logger.error('Error listing municipalities', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{ type: 'text', text: `Error listing municipalities: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
