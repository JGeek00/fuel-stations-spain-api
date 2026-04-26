import { DataTypes, Model } from "sequelize";

export interface LastUpdatedAttributes {
  lastUpdated: Date;
}

export class LastUpdated extends Model<LastUpdatedAttributes> {}

export const LastUpdatedModel = {
  lastUpdated: {
    type: DataTypes.DATE,
    primaryKey: true
  }
}