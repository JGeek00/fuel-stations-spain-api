import { DateTime } from 'luxon';
import { DateTime as LuxonDateTime } from 'luxon';
import { keysToCamel } from '@/utils/case-keys';
import { createBadRequestError, createValidationError } from '@/utils/error-handler';
import { formatRange, getHistoricDataMaxRangeMonths } from '@/utils/historic-data-limit';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';
import type { HistoricPrice } from '@/models/entities/HistoricPrice.model';

export interface GetHistoricPricesInput {
  id: string | string[];
  startDate: string;
  endDate: string;
  includeCurrentPrices?: boolean;
}

/**
 * Historic query use case — owns date parsing, range rules and the
 * camelCase + current-prices presentation. Shared by REST and MCP.
 * Moved verbatim from historic-prices.controller.
 */
export async function getHistoricPricesUseCase(input: GetHistoricPricesInput) {
  let startDate: DateTime;
  try {
    startDate = DateTime.fromSQL(input.startDate as string);
  } catch {
    throw createValidationError('Invalid format for startDate. Must be yyyy-mm-dd.');
  }

  let endDate: DateTime;
  try {
    endDate = DateTime.fromSQL(input.endDate as string);
  } catch {
    throw createValidationError('Invalid format for endDate. Must be yyyy-mm-dd.');
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = startDate.setZone(timezone);
  const end = endDate.setZone(timezone);

  if (isNaN(end.diff(start).as('days'))) {
    throw createBadRequestError('startDate must be an earlier date than endDate');
  }

  const maxRangeMonths = getHistoricDataMaxRangeMonths();
  if (maxRangeMonths !== null && end.diff(start).as('months') > maxRangeMonths) {
    throw createBadRequestError(`The maximum difference between the dates cannot be greater than ${formatRange(maxRangeMonths)}`);
  }

  const stationId = Array.isArray(input.id) ? input.id[0] : (input.id as string);
  const historicResult = await historicRepository.queryRange(
    stationId,
    start.toSQLDate() as string,
    end.toSQLDate() as string,
  );

  let currentPrices: Record<string, unknown> | null = null;
  if (!!input.includeCurrentPrices) {
    currentPrices = await historicRepository.queryCurrent(stationId);
  }

  const formattedHistoric = historicResult.map((e: Record<string, unknown>) => {
    const values = keysToCamel(e);
    return values as HistoricPrice;
  });

  if (currentPrices) {
    const values = keysToCamel(currentPrices) as Record<string, unknown>;
    formattedHistoric.push({
      ...values,
      stationId: (values.id ?? values.stationId) ?? null,
      stationSignage: (values.signage ?? values.stationSignage) ?? null,
      date: LuxonDateTime.now().toSQLDate(),
    } as unknown as HistoricPrice);
  }

  return formattedHistoric;
}
