import { Municipality } from "@/models/entities/Municipality.model";

class MunicipalitiesRepository {
  data;

  constructor() {
    this.data = <Municipality[]>[]
  }
}

export default new MunicipalitiesRepository()