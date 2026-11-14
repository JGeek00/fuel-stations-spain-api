import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFuelTypesResource(server: McpServer): void {
  server.registerResource(
    'fuel-types',
    'fuelstations://info/fuel-types',
    {
      description: 'List of all available fuel types with their field names, Spanish names, and units. Use the field names when querying prices via tools.',
      mimeType: 'application/json',
    },
    async () => {
      const fuelTypes = [
        { field: 'gasoilAPrice', name: 'Gasóleo A', commonName: 'Gasolina', unit: '€/L' },
        { field: 'gasoilBPrice', name: 'Gasóleo B (agrícola)', commonName: 'Gasóleo agrícola', unit: '€/L' },
        { field: 'premiumGasoilPrice', name: 'Gasóleo Premium', commonName: 'Gasóleo premium', unit: '€/L' },
        { field: 'gasoline95E5Price', name: 'Gasolina 95 sin plomo E5', commonName: 'Gasolina 95', unit: '€/L' },
        { field: 'gasoline95E5PremiumPrice', name: 'Gasolina 95 sin plomo E5 Premium', commonName: 'Gasolina 95 Premium', unit: '€/L' },
        { field: 'gasoline95E10Price', name: 'Gasolina 95 sin plomo E10', commonName: 'Gasolina 95 E10', unit: '€/L' },
        { field: 'gasoline95E25Price', name: 'Gasolina 95 sin plomo E25', commonName: 'Gasolina 95 E25', unit: '€/L' },
        { field: 'gasoline95E85Price', name: 'Gasolina 95 sin plomo E85', commonName: 'Gasolina E85', unit: '€/L' },
        { field: 'gasoline98E5Price', name: 'Gasolina 98 sin plomo E5', commonName: 'Gasolina 98', unit: '€/L' },
        { field: 'gasoline98E10Price', name: 'Gasolina 98 sin plomo E10', commonName: 'Gasolina 98 E10', unit: '€/L' },
        { field: 'lpgPrice', name: 'GLP (Gas Licuado de Petróleo)', commonName: 'Gas LP / Autogas', unit: '€/L' },
        { field: 'cngPrice', name: 'GNC (Gas Natural Comprimido)', commonName: 'Gas natural', unit: '€/kg' },
        { field: 'lngPrice', name: 'GNL (Gas Natural Licuado)', commonName: 'Gas natural licuado', unit: '€/kg' },
        { field: 'hydrogenPrice', name: 'Hidrógeno', commonName: 'Hidrógeno', unit: '€/kg' },
        { field: 'adbluePrice', name: 'AdBlue', commonName: 'AdBlue', unit: '€/L' },
        { field: 'biodieselPrice', name: 'Biodiesel', commonName: 'Biodiesel', unit: '€/L' },
        { field: 'bioethanolPrice', name: 'Bioetanol', commonName: 'Bioetanol', unit: '€/L' },
        { field: 'compressedBiogasPrice', name: 'Biogas Comprimido', commonName: 'Biogas', unit: '€/kg' },
        { field: 'liquefiedBiogasPrice', name: 'Biogas Licuado', commonName: 'Biogas licuado', unit: '€/kg' },
        { field: 'renewableDieselPrice', name: 'Gasóleo Renovable', commonName: 'Diésel renovable', unit: '€/L' },
        { field: 'renewableGasolinePrice', name: 'Gasolina Renovable', commonName: 'Gasolina renovable', unit: '€/L' },
        { field: 'methanolPrice', name: 'Metanol', commonName: 'Metanol', unit: '€/L' },
        { field: 'ammoniaPrice', name: 'Amoníaco', commonName: 'Amoníaco', unit: '€/L' },
      ];

      return {
        contents: [
          {
            uri: 'fuelstations://info/fuel-types',
            mimeType: 'application/json',
            text: JSON.stringify(fuelTypes, null, 2),
          },
        ],
      };
    }
  );
}
