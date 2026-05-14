import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import MunicipalitiesStore from '@/data/municipalities-store';
import { Municipality } from '@/models/entities/Municipality.model';

export function listMunicipalitiesTool(server: McpServer, municipalitiesStore: typeof MunicipalitiesStore): void {
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
        const { province, region, search } = args;
        let data: Municipality[] = municipalitiesStore.data || [];

        if (province) {
          data = data.filter((m) => m.province.toLowerCase().includes(province.toLowerCase()));
        }
        if (region) {
          data = data.filter((m) => m.region.toLowerCase().includes(region.toLowerCase()));
        }
        if (search) {
          data = data.filter((m) => m.municipality.toLowerCase().includes(search.toLowerCase()));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: data.length, municipalities: data }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing municipalities: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
