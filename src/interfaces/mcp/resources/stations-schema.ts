import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerStationsSchemaResource(server: McpServer): void {
  server.registerResource(
    'stations-schema',
    'fuelstations://schema/stations',
    {
      description: 'Schema definition of the FuelStation table (realtime data). Shows all available fields with their types and descriptions.',
      mimeType: 'application/json',
    },
    async () => {
      const schema = {
        table: 'FuelStation',
        database: 'SQLite (in-memory)',
        description: 'Real-time fuel station data with current prices',
        fields: {
          id: { type: 'string', description: 'Unique station identifier' },
          postalCode: { type: 'string', description: 'Postal code' },
          address: { type: 'string', description: 'Street address' },
          openingHours: { type: 'string', description: 'Opening hours (24h format)' },
          latitude: { type: 'number', description: 'GPS latitude' },
          longitude: { type: 'number', description: 'GPS longitude' },
          locality: { type: 'string', description: 'Locality name' },
          margin: { type: 'string', description: 'Station margin code' },
          municipality: { type: 'string', description: 'Municipality name' },
          province: { type: 'string', description: 'Province name' },
          referral: { type: 'string', description: 'Station referral/brand name' },
          signage: { type: 'string', description: 'Station signage/brand' },
          saleType: { type: 'string', description: 'Sale type code' },
          percBioEthanol: { type: 'string', description: 'Bioethanol percentage' },
          percMethylEster: { type: 'string', description: 'Methyl ester percentage' },
          municipalityId: { type: 'number', description: 'Municipality numeric ID' },
          provinceId: { type: 'number', description: 'Province numeric ID' },
          regionId: { type: 'number', description: 'Autonomous community region ID' },
          // Fuel price fields (all in €/liter)
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
      };

      return {
        contents: [
          {
            uri: 'fuelstations://schema/stations',
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
  );
}
