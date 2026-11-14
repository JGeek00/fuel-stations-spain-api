import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import { listMunicipalitiesUseCase } from '@/application/usecases/ListMunicipalities.usecase';

export function registerMunicipalitiesResource(server: McpServer, _municipalitiesStore: typeof MunicipalitiesRepository): void {
  server.registerResource(
    'municipalities-list',
    'fuelstations://municipalities/all',
    {
      description: 'Complete list of all Spanish municipalities with their IDs, province, and autonomous community (region).',
      mimeType: 'application/json',
    },
    async () => {
      const result = listMunicipalitiesUseCase();
      return {
        contents: [
          {
            uri: 'fuelstations://municipalities/all',
            mimeType: 'application/json',
            text: JSON.stringify({ count: result.municipalities.length, municipalities: result.municipalities }, null, 2),
          },
        ],
      };
    }
  );
}
