/**
 * Single source of truth for fuel price field names.
 * Replaces the triplicated FUEL_FIELD_NAMES in MCP tools
 * (find-cheapest-fuel, compare-fuel-prices) + resources/fuel-types.
 */
export const FUEL_FIELD_NAMES = [
  'gasoilAPrice',
  'gasoilBPrice',
  'premiumGasoilPrice',
  'gasoline95E5Price',
  'gasoline95E5PremiumPrice',
  'gasoline95E10Price',
  'gasoline95E25Price',
  'gasoline95E85Price',
  'gasoline98E5Price',
  'gasoline98E10Price',
  'lpgPrice',
  'cngPrice',
  'lngPrice',
  'hydrogenPrice',
  'adbluePrice',
  'biodieselPrice',
  'bioethanolPrice',
  'compressedBiogasPrice',
  'liquefiedBiogasPrice',
  'renewableDieselPrice',
  'renewableGasolinePrice',
  'methanolPrice',
  'ammoniaPrice',
] as const;

export type FuelField = (typeof FUEL_FIELD_NAMES)[number];

/** Columns of the 25-field historic select (controller + MCP tool shared). */
export const HISTORIC_PRICE_COLUMNS = [
  'stationId',
  'stationSignage',
  'adbluePrice',
  'ammoniaPrice',
  'biodieselPrice',
  'bioethanolPrice',
  'compressedBiogasPrice',
  'liquefiedBiogasPrice',
  'renewableDieselPrice',
  'cngPrice',
  'lngPrice',
  'lpgPrice',
  'gasoilAPrice',
  'gasoilBPrice',
  'premiumGasoilPrice',
  'gasoline95E10Price',
  'gasoline95E25Price',
  'gasoline95E5Price',
  'gasoline95E5PremiumPrice',
  'gasoline95E85Price',
  'gasoline98E10Price',
  'gasoline98E5Price',
  'renewableGasolinePrice',
  'hydrogenPrice',
  'methanolPrice',
  'date',
] as const;
