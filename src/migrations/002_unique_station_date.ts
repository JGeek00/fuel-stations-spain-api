import { Sequelize } from 'sequelize';
import { Migration } from '@/models/entities';

const INDEX_NAME = 'idx_historic_station_date';

const migration: Migration = {
  version: '002',
  name: 'unique_station_date',
  up: async (sequelize: Sequelize) => {
    await sequelize.query(
      `CREATE UNIQUE INDEX ${INDEX_NAME} ON historic_data ("stationId", "date")`
    );
    await sequelize.query(`
      CREATE TABLE historic_no_data (
        "date" DATE PRIMARY KEY
      )
    `);
  },
  down: async (sequelize: Sequelize) => {
    await sequelize.query(`DROP TABLE IF EXISTS historic_no_data`);
    await sequelize.query(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
  },
};

export default migration;
