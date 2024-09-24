import { DataTypes, Model } from "sequelize";

export class LastUpdated extends Model {}

export const LastUpdatedModel = {
  lastUpdated: {
    type: DataTypes.DATE,
    primaryKey: true
  }
}