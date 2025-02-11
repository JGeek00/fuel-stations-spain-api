import { formatCurrentDate } from "@/utils/datetime-formatter";
import { startRealtimeDataCron } from "@/utils/cron";
import { loadStations } from "@/services/data-loader/load-realtime-data";
import { loadMunicipalities } from "@/services/data-loader/load-municipalities";
import { loadPersistedData } from "@/services/data-loader/load-persisted-data";

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

export const loadPersistedDataProgrammed = () => {
  console.log(`🕒 Starting programmed load for persistedData: ${formatCurrentDate()}`)
  loadPersistedData()
}