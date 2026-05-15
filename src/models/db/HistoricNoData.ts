import { DataTypes, Model } from "sequelize";
import { HistoricNoData } from '@/models/entities';

export class HistoricNoDataTable extends Model<HistoricNoData> {}

export const HistoricNoDataModel = {
  date: { type: DataTypes.DATEONLY, primaryKey: true },
};
