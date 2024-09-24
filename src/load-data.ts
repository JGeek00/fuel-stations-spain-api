import axios from "axios"
import { ServiceStationsResult } from "./models/service-stations-result";
import { assertEquals } from "typia";
import { FuelStation } from "./models/db/fuel-station";
import { formatCurrentDate } from "./utils/datetime-formatter";

export const loadDataOnStart = () => {
  console.log(`Fetch data on start: ${formatCurrentDate()}`)
  loadData()
}

export const loadData = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assertEquals<ServiceStationsResult>(result.data)
    if (!parsedResult.ListaEESSPrecio) {
      throw new Error("ListaEESSPrecio is null")
    }
    await FuelStation.bulkCreate(parsedResult.ListaEESSPrecio?.map(station => {
      return {
        postalCode: station["C.P."],
        address: station.Dirección,
        openingHours: station.Horario,
        latitude: station.Latitud,
        longitude: station["Longitud (WGS84)"],
        locality: station.Localidad,
        margin: station.Margen,
        municipio: station.Municipio,
        provincia: station.Provincia,
        referral: station.Remisión,
        signage: station.Rótulo,
        saleType: station["Tipo Venta"],
        percBioEthanol: station["% BioEtanol"],
        percMethylEster: station["% Éster metílico"],
        IDEESS: station.IDEESS,
        municipalityId: station.IDMunicipio,
        provinceId: station.IDProvincia,
        regionId: station.IDCCAA,
        biodieselPrice: station["Precio Biodiesel"],
        bioethanolPrice: station["Precio Bioetanol"],
        CNGPrice: station["Precio Gas Natural Comprimido"],
        LNGPrice: station["Precio Gas Natural Licuado"],
        LPGPrice: station["Precio Gases licuados del petróleo"],
        gasoilAPrice: station["Precio Gasoleo A"],
        gasoilBPrice: station["Precio Gasoleo B"],
        premiumGasoilPrice: station["Precio Gasoleo Premium"],
        gasoline95E10Price: station["Precio Gasolina 95 E10"],
        gasoline95E5Price: station["Precio Gasolina 95 E5"],
        gasoline95E5PremiumPrice: station["Precio Gasolina 95 E5 Premium"],
        gasoline98E10Price: station["Precio Gasolina 98 E10"],
        gasoline98E5Price: station["Precio Gasolina 98 E5"],
        hydrogenPrice: station["Precio Hidrogeno"],
      }
    }))
    console.log("✅ Data saved successfully")
  } catch (error) {
    console.error(error)
  }
}