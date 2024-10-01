import { Municipality } from "@/models/municipality.model";

class MunicipalitiesStore {
  data;

  constructor() {
    this.data = <Municipality[]>[]
  }
}

export default new MunicipalitiesStore()