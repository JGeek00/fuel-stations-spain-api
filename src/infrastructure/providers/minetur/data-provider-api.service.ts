import typia from "typia";
import { DateTime } from "luxon";
import { API_BASE_URL } from "@/shared/config/constants";
import { twoDigits } from "@/shared/utils/numbers";
import { MunicipalitiesDto, ServiceStationsDto } from "@/infrastructure/providers/minetur/dto";
import { logger } from "@/shared/utils/logger";

const commonHeaders = {
  "Content-Type": "application/json"
};

export class DataProviderApiService {
  static getStations = async (): Promise<ServiceStationsDto | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/EstacionesTerrestres/`, {
        headers: commonHeaders
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const parsed = typia.assert<ServiceStationsDto>(data);
      return parsed;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  static getStationsHistoric = async (date: DateTime): Promise<ServiceStationsDto | null> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/EstacionesTerrestresHist/${twoDigits(date.get('day'))}-${twoDigits(date.get('month'))}-${twoDigits(date.get('year'))}`,
        { headers: commonHeaders }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const parsed = typia.assert<ServiceStationsDto>(data);
      return parsed;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  static getMunicipalities = async (): Promise<MunicipalitiesDto[] | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/Listados/Municipios`, {
        headers: commonHeaders
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const parsed = typia.assert<MunicipalitiesDto[]>(data);
      return parsed;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }
}
