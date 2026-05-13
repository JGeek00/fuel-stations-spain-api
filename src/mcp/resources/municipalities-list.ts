import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import MunicipalitiesStore from '@/data/municipalities-store';

export function registerMunicipalitiesResource(server: McpServer, municipalitiesStore: typeof MunicipalitiesStore): void {
  server.registerResource(
    'municipalities-list',
    'fuelstations://municipalities/all',
    {
      description: 'Complete list of all Spanish municipalities with their IDs, province, and autonomous community (region).',
      mimeType: 'application/json',
    },
    async () => {
      const data = municipalitiesStore.data || [];

      return {
        contents: [
          {
            uri: 'fuelstations://municipalities/all',
            mimeType: 'application/json',
            text: JSON.stringify({ count: data.length, municipalities: data }, null, 2),
          },
        ],
      };
    }
  );
}
