import axios from "axios"
import { assertEquals } from "typia";
import { DateTime, Interval } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';
import { ServiceStationsResult } from "@/models/service-stations-result";
import { FuelStation } from "@/models/db/fuel-station";
import { formatCurrentDate } from "@/utils/datetime-formatter";
import { LastUpdated } from "@/models/db/last-updated";
import { parseStringToFloat } from "@/utils/parser";
import { startRealtimeDataCron } from "@/utils/cron";
import MunicipalitiesStore from "@/data/municipalities-store";
import { HistoricFuelStation } from "@/models/db/historic-fuel-station";
import { twoDigits } from "@/utils/numbers";
import { sleep } from "@/utils/sleep";
import { FormattedStation } from "@/models/formatted-station";

export const loadDataOnStart = async () => {
  console.log(`Fetch data on API start: ${formatCurrentDate()}`)

  await loadMemoryData()

  startRealtimeDataCron()
}

export const loadRealtimeDataProgrammed = () => {
  console.log(`🕒 Starting programmed load for realtime data: ${formatCurrentDate()}`)
  loadMemoryData()
}

const loadMemoryData = async() => {
  await Promise.all([
    loadStations(),
    loadMunicipalities()
  ])
}

const loadStations = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assertEquals<ServiceStationsResult>(result.data)
    if (!parsedResult.ListaEESSPrecio) {
      throw new Error("ListaEESSPrecio is null")
    }

    // Erase previous data
    await FuelStation.truncate()
    await LastUpdated.truncate()

    // Save new data
    await FuelStation.bulkCreate(parsedResult.ListaEESSPrecio?.map(station => {
      return {
        id: station.IDEESS,
        postalCode: station["C.P."],
        address: station.Dirección,
        openingHours: station.Horario,
        latitude: parseStringToFloat(station.Latitud),
        longitude: parseStringToFloat(station["Longitud (WGS84)"]),
        locality: station.Localidad,
        margin: station.Margen,
        municipio: station.Municipio,
        provincia: station.Provincia,
        referral: station.Remisión,
        signage: station.Rótulo,
        saleType: station["Tipo Venta"],
        percBioEthanol: parseStringToFloat(station["% BioEtanol"]),
        percMethylEster: parseStringToFloat(station["% Éster metílico"]),
        municipalityId: station.IDMunicipio ? parseInt(station.IDMunicipio) : null,
        provinceId: station.IDProvincia ? parseInt(station.IDProvincia) : null,
        regionId: station.IDCCAA ? parseInt(station.IDCCAA) : null,
        biodieselPrice: parseStringToFloat(station["Precio Biodiesel"]),
        bioethanolPrice: parseStringToFloat(station["Precio Bioetanol"]),
        CNGPrice: parseStringToFloat(station["Precio Gas Natural Comprimido"]),
        LNGPrice: parseStringToFloat(station["Precio Gas Natural Licuado"]),
        LPGPrice: parseStringToFloat(station["Precio Gases licuados del petróleo"]),
        gasoilAPrice: parseStringToFloat(station["Precio Gasoleo A"]),
        gasoilBPrice: parseStringToFloat(station["Precio Gasoleo B"]),
        premiumGasoilPrice: parseStringToFloat(station["Precio Gasoleo Premium"]),
        gasoline95E10Price: parseStringToFloat(station["Precio Gasolina 95 E10"]),
        gasoline95E5Price: parseStringToFloat(station["Precio Gasolina 95 E5"]),
        gasoline95E5PremiumPrice: parseStringToFloat(station["Precio Gasolina 95 E5 Premium"]),
        gasoline98E10Price: parseStringToFloat(station["Precio Gasolina 98 E10"]),
        gasoline98E5Price: parseStringToFloat(station["Precio Gasolina 98 E5"]),
        hydrogenPrice: parseStringToFloat(station["Precio Hidrogeno"]),
      }
    }))

    await LastUpdated.create({
      lastUpdated: new Date()
    })

    console.log("✅ Realtime data saved successfully")
  } catch (error) {
    console.error(error)
  }
}

const loadMunicipalities = async () => {
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

export const loadPersistedDataProgrammed = () => {
  console.log(`🕒 Starting programmed load for persistedData: ${formatCurrentDate()}`)
  loadPersistedData()
}

export const loadPersistedData = async () => {
  try {
    const lastDateDb = await HistoricFuelStation.findOne({
      attributes: ['date'],
      group: ['date'],
      order: [
        ['date', 'DESC'],
      ],
      limit: 1
    })
  
    if (!lastDateDb) {
      console.error("❌ Persistent DB has no data. You must import manually the data first.")
      return
    }
  
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = DateTime.now().setZone(timezone)
    const firstDate = DateTime.fromSQL(lastDateDb.toJSON().date).setZone(timezone)
    const interval = Interval.fromDateTimes(firstDate, today.minus({ days: 1 })).length('days')   // exclude current day
    const datesToFetch = []
    for (let i = 1; i < interval; i++) {
      const dateToAdd = firstDate.plus({ days: i })
      datesToFetch.push(dateToAdd)
    }

    if (datesToFetch.length === 0) {
      console.log("🗓️ No new dates to fetch for the historic")
      return
    }

    const grouped = [];
    for (let i = 0; i < datesToFetch.length; i += 7) {
      grouped.push(datesToFetch.slice(i, i + 7));
    }

    console.log(`🗓️ ${datesToFetch.length} dates will be fetched (${grouped.length}) groups`)

    let stations: Array<FormattedStation> = []

    for (const groupKey in grouped) {
      const group = grouped[groupKey]
    
      const queries = group.map(date => {
        return axios.get(`https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/${twoDigits(date.get('day'))}-${twoDigits(date.get('month'))}-${twoDigits(date.get('year'))}`)
      })
  
      console.log(`🛜 Fetch group ${groupKey}: ${twoDigits(group[0].day)}-${twoDigits(group[0].month)}-${group[0].year} to ${twoDigits(group[group.length-1].day)}-${twoDigits(group[group.length-1].month)}-${group[group.length-1].year}`)
      const results = await Promise.all(queries)
      console.log(`✅ Group ${groupKey} fetched successfully`)

      for (const key in results) {
        const parsedResult = assertEquals<ServiceStationsResult>(results[key].data)
        if (!parsedResult.ListaEESSPrecio || !parsedResult.Fecha) {
          throw new Error("ListaEESSPrecio or Fecha is null")
        }
        
        const parsedStations = parsedResult.ListaEESSPrecio.map(station => {
          const d = DateTime.fromFormat(parsedResult.Fecha!, "dd/MM/yyyy h:mm:ss").setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
          return <FormattedStation>{
            stationId: station.IDEESS ?? null,
            biodieselPrice: parseStringToFloat(station["Precio Biodiesel"]),
            bioethanolPrice: parseStringToFloat(station["Precio Bioetanol"]),
            CNGPrice: parseStringToFloat(station["Precio Gas Natural Comprimido"]),
            LNGPrice: parseStringToFloat(station["Precio Gas Natural Licuado"]),
            LPGPrice: parseStringToFloat(station["Precio Gases licuados del petróleo"]),
            gasoilAPrice: parseStringToFloat(station["Precio Gasoleo A"]),
            gasoilBPrice: parseStringToFloat(station["Precio Gasoleo B"]),
            premiumGasoilPrice: parseStringToFloat(station["Precio Gasoleo Premium"]),
            gasoline95E10Price: parseStringToFloat(station["Precio Gasolina 95 E10"]),
            gasoline95E5Price: parseStringToFloat(station["Precio Gasolina 95 E5"]),
            gasoline95E5PremiumPrice: parseStringToFloat(station["Precio Gasolina 95 E5 Premium"]),
            gasoline98E10Price: parseStringToFloat(station["Precio Gasolina 98 E10"]),
            gasoline98E5Price: parseStringToFloat(station["Precio Gasolina 98 E5"]),
            hydrogenPrice: parseStringToFloat(station["Precio Hidrogeno"]),
            date: d.toSQLDate()
          }
        })
        stations = [
          ...stations,
          ...parsedStations
        ]
      }

      // sleep only if there are more groups remaining
      if (parseInt(groupKey) < grouped.length-1) {
        await sleep(60000)  // Sleep 1 minute
      }
    }

    console.log("⬇️ Saving data into the persistent database")    
    await HistoricFuelStation.bulkCreate(stations.map(station => {
      return {
        id: uuidv4(),
        station_id: station.stationId,
        biodiesel_price: station.biodieselPrice,
        bioethanol_price: station.bioethanolPrice,
        cng_price: station.CNGPrice,
        lng_price: station.LNGPrice,
        lpg_price: station.LPGPrice,
        gasoil_a_price: station.gasoilAPrice,
        gasoil_b_price: station.gasoilBPrice,
        premium_gasoil_price: station.premiumGasoilPrice,
        gasoline_95_e10_price: station.gasoline95E10Price,
        gasoline_95_e5_price: station.gasoline95E5Price,
        gasoline_95_e5_premium_price: station.gasoline95E5PremiumPrice,
        gasoline_98_e10_price: station.gasoline98E10Price,
        gasoline_98_e5_price: station.gasoline98E5Price,
        hydrogen_price: station.hydrogenPrice,
        date: station.date
      }
    }))
    console.log("✅ Historic data saved successfully")    
  } catch (error) {
    Sentry.captureException(error)
    console.error(error)
  }
}