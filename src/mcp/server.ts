import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseService } from '@/services/database/database.service';
import MunicipalitiesRepository from '@/repository/Municipalities/Municipalities.repository';
import { compareFuelPricesTool, findCheapestFuelTool, getDatabaseStatusTool, getStationInfoTool, listMunicipalitiesTool, queryFuelStationsTool, queryHistoricPricesTool, searchByLocationTool } from '@/mcp/tools';
import { registerDatabaseInfoResource, registerFuelTypesResource, registerHistoricSchemaResource, registerMunicipalitiesResource, registerStationsSchemaResource } from '@/mcp/resources';
import packageJson from '../../package.json';

/**
 * Registers all tools and resources on an existing McpServer instance.
 */
function registerAll(server: McpServer, databaseService: DatabaseService): void {
  // Tools
  queryFuelStationsTool(server, databaseService);
  searchByLocationTool(server, databaseService);
  getStationInfoTool(server, databaseService);
  queryHistoricPricesTool(server, databaseService);
  listMunicipalitiesTool(server, MunicipalitiesRepository);
  compareFuelPricesTool(server, databaseService);
  findCheapestFuelTool(server, databaseService);
  getDatabaseStatusTool(server, databaseService);

  // Resources
  registerStationsSchemaResource(server);
  registerHistoricSchemaResource(server);
  registerFuelTypesResource(server);
  registerDatabaseInfoResource(server, databaseService);
  registerMunicipalitiesResource(server, MunicipalitiesRepository);
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
