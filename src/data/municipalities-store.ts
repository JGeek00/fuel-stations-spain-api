import { Municipality } from "@/interfaces/Municipality.model";

class MunicipalitiesStore {
  data;

  constructor() {
    this.data = <Municipality[]>[]
  }
}

export default new MunicipalitiesStore()