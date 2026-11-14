import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { municipalitiesRepository } from '@/infrastructure/persistence/MunicipalitiesRepository';
import { compareFuelPricesTool, findCheapestFuelTool, getDatabaseStatusTool, getStationInfoTool, listMunicipalitiesTool, queryFuelStationsTool, queryHistoricPricesTool, searchByLocationTool } from '@/interfaces/mcp/tools';
import { registerDatabaseInfoResource, registerFuelTypesResource, registerHistoricSchemaResource, registerMunicipalitiesResource, registerStationsSchemaResource } from '@/interfaces/mcp/resources';
import packageJson from '../../../package.json';

/**
 * Registers all tools and resources on an existing McpServer instance.
 */
function registerAll(server: McpServer, databaseService: DatabaseService): void {
  // Tools
  queryFuelStationsTool(server, databaseService);
  searchByLocationTool(server, databaseService);
  getStationInfoTool(server, databaseService);
  queryHistoricPricesTool(server, databaseService);
  listMunicipalitiesTool(server, municipalitiesRepository);
  compareFuelPricesTool(server, databaseService);
  findCheapestFuelTool(server, databaseService);
  getDatabaseStatusTool(server, databaseService);

  // Resources
  registerStationsSchemaResource(server);
  registerHistoricSchemaResource(server);
  registerFuelTypesResource(server);
  registerDatabaseInfoResource(server, databaseService);
  registerMunicipalitiesResource(server, municipalitiesRepository);
}

/**
 * Factory that creates a new, independent McpServer instance with all tools
 * and resources registered.
 */
export function createMcpServerInstance(databaseService: DatabaseService): McpServer {
  const server = new McpServer({
    name: 'fuel-stations-spain-mcp',
    version: packageJson.version,
  }, {
    instructions: 'MCP server for Fuel Stations Spain API. Query real-time fuel prices, historical data, and municipality information for gas stations across Spain.',
  });

  registerAll(server, databaseService);
  return server;
}
