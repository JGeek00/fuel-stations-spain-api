import { Sequelize } from 'sequelize';
import { Migration } from '@/models/entities';

const RENAME_COLUMNS = [
  ['station_id', 'stationId'],
  ['station_signage', 'stationSignage'],
  ['adblue_price', 'adbluePrice'],
  ['ammonia_price', 'ammoniaPrice'],
  ['biodiesel_price', 'biodieselPrice'],
  ['bioethanol_price', 'bioethanolPrice'],
  ['compressed_biogas_price', 'compressedBiogasPrice'],
  ['liquefied_biogas_price', 'liquefiedBiogasPrice'],
  ['renewable_diesel_price', 'renewableDieselPrice'],
  ['cng_price', 'cngPrice'],
  ['lng_price', 'lngPrice'],
  ['lpg_price', 'lpgPrice'],
  ['gasoil_a_price', 'gasoilAPrice'],
  ['gasoil_b_price', 'gasoilBPrice'],
  ['premium_gasoil_price', 'premiumGasoilPrice'],
  ['gasoline_95_e10_price', 'gasoline95E10Price'],
  ['gasoline_95_e25_price', 'gasoline95E25Price'],
  ['gasoline_95_e5_price', 'gasoline95E5Price'],
  ['gasoline_95_e5_premium_price', 'gasoline95E5PremiumPrice'],
  ['gasoline_95_e85_price', 'gasoline95E85Price'],
  ['gasoline_98_e10_price', 'gasoline98E10Price'],
  ['gasoline_98_e5_price', 'gasoline98E5Price'],
  ['renewable_gasoline_price', 'renewableGasolinePrice'],
  ['hydrogen_price', 'hydrogenPrice'],
  ['methanol_price', 'methanolPrice'],
];

const migration: Migration = {
  version: '001',
  name: 'baseline',
  up: async (sequelize: Sequelize) => {
    // Rename historic_data columns from snake_case to camelCase (match FuelStations schema)
    for (const [oldName, newName] of RENAME_COLUMNS) {
      await sequelize.query(
        `ALTER TABLE historic_data RENAME COLUMN "${oldName}" TO "${newName}"`
      );
    }
  },
  down: async (sequelize: Sequelize) => {
    // Reverse: rename columns back from camelCase to snake_case
    for (const [snake, camel] of [...RENAME_COLUMNS].reverse()) {
      await sequelize.query(
        `ALTER TABLE historic_data RENAME COLUMN "${camel}" TO "${snake}"`
      );
    }
  },
};

export default migration;
