import axios from "axios"
import typia from "typia";
import { DateTime } from "luxon";
import { API_BASE_URL } from "@/config/constants";
import { twoDigits } from "@/utils/numbers";
import { ServiceStationsDto } from "@/repository/dto/ServiceStations.dto";
import { MunicipalitiesDto } from "@/repository/dto/Municipalities.dto";

export class DataProviderApiService {
  static getStations = async (): Promise<ServiceStationsDto | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/EstacionesTerrestres/`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<ServiceStationsDto>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }

  static getStationsHistoric = async (date: DateTime): Promise<ServiceStationsDto | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/EstacionesTerrestresHist/${twoDigits(date.get('day'))}-${twoDigits(date.get('month'))}-${twoDigits(date.get('year'))}`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<ServiceStationsDto>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }

  static getMunicipalities = async (): Promise<MunicipalitiesDto[] | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/Listados/Municipios`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<MunicipalitiesDto[]>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }
}
