export interface GetFuelStationsQueryParams {
  limit?: number;
  offset?: number;
  municipalityId?: number;
  id?: string | string[];
  coordinates?: string;
  distance?: number;
}