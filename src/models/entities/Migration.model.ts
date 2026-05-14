import { Sequelize } from "sequelize";

export interface Migration {
  version: string;
  name: string;
  up: (sequelize: Sequelize) => Promise<void>;
  down: (sequelize: Sequelize) => Promise<void>;
}