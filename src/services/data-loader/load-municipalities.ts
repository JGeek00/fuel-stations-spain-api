import axios from "axios"
import MunicipalitiesStore from "@/data/municipalities-store";

export const loadMunicipalities = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Municipios", {
      headers: {
        "Content-Type": "application/json"
      }
    })

    var data = JSON.stringify(result.data)
    data = data.replaceAll("IDMunicipio", "municipalityId")
    data = data.replaceAll("IDProvincia", "provinceId")
    data = data.replaceAll("IDCCAA", "regionId")
    data = data.replaceAll("Municipio", "municipality")
    data = data.replaceAll("Provincia", "province")
    data = data.replaceAll("CCAA", "region")
    let parsed = JSON.parse(data)

    MunicipalitiesStore.data = parsed

    console.log("✅ Municipalities saved successfully")
  } catch (error) {
    console.error(error)
  }
}