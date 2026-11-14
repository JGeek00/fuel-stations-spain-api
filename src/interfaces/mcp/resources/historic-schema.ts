import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerHistoricSchemaResource(server: McpServer): void {
  server.registerResource(
    'historic-schema',
    'fuelstations://schema/historic',
    {
      description: 'Schema definition of the HistoricFuelStation table (persistent historic data). Shows all available fields with their types and descriptions.',
      mimeType: 'application/json',
    },
    async () => {
      const schema = {
        table: 'HistoricFuelStation',
        database: 'PostgreSQL',
        description: 'Historical fuel price records per station per date',
        fields: {
          id: { type: 'uuid', description: 'Primary key (auto-generated UUID)' },
          stationId: { type: 'string', description: 'Reference to FuelStation.id' },
          stationSignage: { type: 'string', description: 'Station brand/signage at the time of recording' },
          date: { type: 'date', description: 'Date of the price recording (yyyy-mm-dd)' },
          // Fuel price fields (all in €/liter, snake_case in DB, camelCase in API)
          gasoilAPrice: { type: 'number', description: 'Gasoil A price (€/L)' },
          gasoilBPrice: { type: 'number', description: 'Gasoil B price (€/L)' },
          premiumGasoilPrice: { type: 'number', description: 'Premium Gasoil price (€/L)' },
          gasoline95E5Price: { type: 'number', description: 'Gasolina 95 E5 price (€/L)' },
          gasoline95E5PremiumPrice: { type: 'number', description: 'Gasolina 95 E5 Premium price (€/L)' },
          gasoline95E10Price: { type: 'number', description: 'Gasolina 95 E10 price (€/L)' },
          gasoline95E25Price: { type: 'number', description: 'Gasolina 95 E25 price (€/L)' },
          gasoline95E85Price: { type: 'number', description: 'Gasolina 95 E85 price (€/L)' },
          gasoline98E5Price: { type: 'number', description: 'Gasolina 98 E5 price (€/L)' },
          gasoline98E10Price: { type: 'number', description: 'Gasolina 98 E10 price (€/L)' },
          lpgPrice: { type: 'number', description: 'LPG price (€/L)' },
          cngPrice: { type: 'number', description: 'CNG price (€/kg)' },
          lngPrice: { type: 'number', description: 'LNG price (€/kg)' },
          hydrogenPrice: { type: 'number', description: 'Hydrogen price (€/kg)' },
          adbluePrice: { type: 'number', description: 'AdBlue price (€/L)' },
          biodieselPrice: { type: 'number', description: 'Biodiesel price (€/L)' },
          bioethanolPrice: { type: 'number', description: 'Bioethanol price (€/L)' },
          compressedBiogasPrice: { type: 'number', description: 'Compressed biogas price (€/kg)' },
          liquefiedBiogasPrice: { type: 'number', description: 'Liquefied biogas price (€/kg)' },
          renewableDieselPrice: { type: 'number', description: 'Renewable diesel price (€/L)' },
          renewableGasolinePrice: { type: 'number', description: 'Renewable gasoline price (€/L)' },
          methanolPrice: { type: 'number', description: 'Methanol price (€/L)' },
          ammoniaPrice: { type: 'number', description: 'Ammonia price (€/L)' },
        },
        notes: [
          'Prices are recorded daily (when data is available from the government API)',
          'Maximum data retention is ~1 year (older records are automatically deleted)',
          'Data must be pre-imported before the API can fetch remaining historic records',
        ],
      };

      return {
        contents: [
          {
            uri: 'fuelstations://schema/historic',
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
  );
}
