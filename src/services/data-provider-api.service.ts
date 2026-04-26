import axios from "axios"
import typia from "typia";
import { DateTime } from "luxon";
import { API_BASE_URL } from "@/config/constants";
import { ServiceStationsResponse } from "@/interfaces/ServiceStationsResponse.model";
import { MunicipalitiesResponse } from "@/interfaces/MunicipalitiesResponse.model";
import { twoDigits } from "@/utils/numbers";

export class DataProviderApiService {
  static getStations = async (): Promise<ServiceStationsResponse | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/EstacionesTerrestres/`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<ServiceStationsResponse>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }

  static getStationsHistoric = async (date: DateTime): Promise<ServiceStationsResponse | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/EstacionesTerrestresHist/${twoDigits(date.get('day'))}-${twoDigits(date.get('month'))}-${twoDigits(date.get('year'))}`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<ServiceStationsResponse>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }

  static getMunicipalities = async (): Promise<MunicipalitiesResponse[] | null> => {
    try {
      const result = await axios.get(`${API_BASE_URL}/Listados/Municipios`, {
        headers: {
          "Content-Type": "application/json"
        }
      })
      const parsed = typia.assert<MunicipalitiesResponse[]>(result.data)
      return parsed
    } catch (error) {
      console.error(error)
      return null
    }
  }
}
