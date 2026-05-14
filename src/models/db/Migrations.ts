import { DataTypes, Model } from 'sequelize';

export interface MigrationsAttributes {
  version: string;
  name: string;
  appliedAt: Date;
}

export class Migrations extends Model<MigrationsAttributes> {}

export const MigrationsModel = {
  version: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  appliedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
};
