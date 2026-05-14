import { Municipality } from "@/models/entities/Municipality.model";

class MunicipalitiesStore {
  data;

  constructor() {
    this.data = <Municipality[]>[]
  }
}

export default new MunicipalitiesStore()