import { DateTime, Interval } from "luxon";
import * as Sentry from '@sentry/node';
import { randomUUID } from "crypto"
import { CronJob } from "cron/dist/job";
import { BulkCreateOptions } from "sequelize";
import { HistoricFuelStation } from "@/models/db/HistoricFuelStation"
import { HistoricNoDataTable } from "@/models/db/HistoricNoData"
import { DataProviderApiService } from "@/services/data-provider-api.service"
import { logger, sleep, twoDigits } from "@/utils"
import { FuelStationsMapper } from "@/mapper";
import { HistoricPrice } from "@/models/entities/HistoricPrice.model";


class PersistedDataService {
  loadStationsHistoric = async () => {
    try {
      const sequelize = HistoricFuelStation.sequelize;
      if (!sequelize) {
        logger.error("❌ Persistent DB not initialized.");
        return;
      }

      const existingDatesResult = await HistoricFuelStation.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
        order: [['date', 'ASC']]
      });
      const existingDatesRows = existingDatesResult.map(e => e.dataValues.date).filter(e => e != null);

      const existingDates = new Set(existingDatesRows);

      const noDataResultRaw = await HistoricNoDataTable.findAll();
      const noDataResult = noDataResultRaw.map(e => e.dataValues.date).filter(e => e != null);
      const noDataDates = new Set(noDataResult);

      if (existingDates.size === 0) {
        logger.error("❌ Persistent DB has no data. You must import manually the data first.");
        return;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = DateTime.now().setZone(timezone);
      const yesterday = today.minus({ days: 1 });

      // Determine date range boundaries from existing data
      const existingDatesArray = Array.from(existingDates);
      const minDate = DateTime.fromSQL(existingDatesArray[0]).setZone(timezone);
      const maxDate = DateTime.fromSQL(existingDatesArray[existingDatesArray.length - 1]).setZone(timezone);

      // Build full range from minDate to yesterday (or maxDate if yesterday is before maxDate)
      const rangeEnd = yesterday < maxDate ? maxDate : yesterday;
      const totalDays = Interval.fromDateTimes(minDate, rangeEnd).length('days');

      // Find holes: dates in full range that are NOT in DB and NOT known to have no data
      const datesToFetch: DateTime[] = [];
      for (let i = 0; i < totalDays; i++) {
        const dateIn = minDate.plus({ days: i });
        const dateSQL = dateIn.toSQLDate();
        if (dateSQL && !existingDates.has(dateSQL) && !noDataDates.has(dateSQL)) {
          datesToFetch.push(dateIn);
        }
      }

      if (datesToFetch.length === 0) {
        logger.info("🗓️ No new dates to fetch for the historic");
        return;
      }

      logger.info(`🗓️ ${datesToFetch.length} dates to fetch (${existingDates.size} already in DB)`);

      // Group into batches of 7
      const grouped: DateTime[][] = [];
      for (let i = 0; i < datesToFetch.length; i += 7) {
        grouped.push(datesToFetch.slice(i, i + 7));
      }

      logger.info(`${grouped.length} batch(es) to process`);

      for (let batchIndex = 0; batchIndex < grouped.length; batchIndex++) {
        const group = grouped[batchIndex];

        const queries = group.map(date => DataProviderApiService.getStationsHistoric(date));

        logger.info(`🛜 Fetch batch ${batchIndex}: ${twoDigits(group[0].day)}-${twoDigits(group[0].month)}-${group[0].year} to ${twoDigits(group[group.length - 1].day)}-${twoDigits(group[group.length - 1].month)}-${group[group.length - 1].year}`);

        const results = await Promise.all(queries);
        logger.info(`✅ Batch ${batchIndex} fetched successfully`);

        // Parse results and build records for this batch
        const batchStations: HistoricPrice[] = [];

        for (let key = 0; key < results.length; key++) {
          const result = results[key];
          if (!result) {
            logger.error(`  ⚠️ Failed to fetch data for date ${group[key].toSQLDate()}`);
            continue;
          }

          if (!result.ListaEESSPrecio || !result.Fecha) {
            logger.error(`  ⚠️ Invalid response for date ${group[key].toSQLDate()}`);
            continue;
          }

            const parsedStations = FuelStationsMapper.map(result.ListaEESSPrecio).map(station => {
            return <HistoricPrice>{
              ...station,
              stationId: station.stationId,
              stationSignage: station.signage,
              date: DateTime.fromFormat(result.Fecha!, "dd/MM/yyyy h:mm:ss")
                .setZone(timezone)
                .toSQLDate()
            };
          });

          batchStations.push(...parsedStations);

          // Register dates with no data to avoid retrying them
          if (parsedStations.length === 0) {
            const dateSQL = group[key].toSQLDate();
            if (dateSQL) {
              await HistoricNoDataTable.create({ date: dateSQL });
              logger.info(`  🚫 No data for ${dateSQL} — marked as no-data`);
            }
          }
        }

        // Save this batch immediately to the database
        if (batchStations.length > 0) {
          const bulkOptions: BulkCreateOptions = {
            conflict: {
              target: '"stationId", "date"',
              action: 'ignore',
            },
          } as BulkCreateOptions;

          await HistoricFuelStation.bulkCreate(
            batchStations.map(station => ({
              id: randomUUID(),
              ...station,
            })),
            bulkOptions
          );
          logger.info(`  💾 Batch ${batchIndex} saved (${batchStations.length} records)`);
        } else {
          logger.warn(`  ⚠️ Batch ${batchIndex}: no records to save`);
        }

        // Sleep between batches (not after the last one)
        if (batchIndex < grouped.length - 1) {
          await sleep(60000);
        }
      }

      logger.info("✅ Historic data update completed");
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error);
    }
  }

  loadAll = async (): Promise<void> => {
    try {
      await this.loadStationsHistoric();
    } catch (error) {
      logger.error("PersistedDataService.loadAll error:", error);
    }
  }

  registerProgrammedTask = () => {
    // Trigger process every day at 01:00 AM: 0 1 * * *
    CronJob.from({
      cronTime: '0 1 * * *',
      onTick: this.loadAll,
      start: true,
      timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    logger.info('  ⏰ Persisted data cron registered', { cronTime: '0 1 * * *' });
  }
}

export const persistedDataService = new PersistedDataService();
