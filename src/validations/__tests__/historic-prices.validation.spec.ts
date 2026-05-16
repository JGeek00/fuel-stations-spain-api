import { describe, it, expect } from 'vitest';
import { FieldValidationError, validationResult } from 'express-validator';
import type { Request } from 'express';
import { historicPricesValidations } from '../historic-prices.validation';

/**
 * Helper to run validation chains against a mock Express request.
 * Uses chain.run(req) which is the express-validator v7 API for
 * executing validation chains outside of middleware.
 */
async function runValidations(query: Record<string, unknown>) {
  const mockReq = {
    query,
    body: {},
    params: {},
    cookies: {},
    headers: {},
  } as Request;

  for (const chain of historicPricesValidations) {
    await chain.run(mockReq);
  }

  return validationResult(mockReq);
}

describe('historicPricesValidations', () => {
  describe('id parameter', () => {
    it('fails when id is missing', async () => {
      const result = await runValidations({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const errors = result.array();
      const idErrors = errors.filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
      expect(idErrors[0].msg).toBe('The id parameter is required');
    });

    it('succeeds when id is null (.exists() only checks undefined)', async () => {
      const result = await runValidations({
        id: null,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('fails when id is undefined', async () => {
      const result = await runValidations({
        id: undefined,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const errors = result.array();
     const idErrors = errors.filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('succeeds with a valid string id', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('fails when id is an array', async () => {
      const result = await runValidations({
        id: ['ES000123', 'ES000456'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const errors = result.array();
      const idErrors = errors.filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
      expect(idErrors[0].msg).toBe('Only one id parameter is allowed');
    });
  });

 describe('startDate parameter', () => {
    it('fails when startDate is missing', async () => {
      const result = await runValidations({
        id: 'ES000123',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBeGreaterThan(0);
    });

    it('fails when startDate has wrong format (dd/mm/yyyy)', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '01/01/2024',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBeGreaterThan(0);
    });

    it('fails when startDate has wrong format (mm-dd-yyyy)', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '01-12-2024',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBeGreaterThan(0);
    });

    it('fails when startDate is not a date string', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: 'not-a-date',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBeGreaterThan(0);
    });

    it('succeeds with a valid yyyy-mm-dd startDate', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-15',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBe(0);
    });

    it('succeeds with startDate at start of year', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBe(0);
    });

    it('succeeds with startDate at end of year', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-12-31',
        endDate: '2024-12-31',
      });
      const startDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'startDate'
      );
      expect(startDateErrors.length).toBe(0);
    });
  });

  describe('endDate parameter', () => {
    it('fails when endDate is missing', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
      });
      const endDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'endDate'
      );
      expect(endDateErrors.length).toBeGreaterThan(0);
    });

    it('fails when endDate has wrong format (dd-mm-yyyy)', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '31-12-2024',
      });
      const endDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'endDate'
      );
      expect(endDateErrors.length).toBeGreaterThan(0);
    });

    it('fails when endDate is not a date string', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: 'invalid',
      });
      const endDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'endDate'
      );
      expect(endDateErrors.length).toBeGreaterThan(0);
    });

    it('succeeds with a valid yyyy-mm-dd endDate', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const endDateErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'endDate'
      );
      expect(endDateErrors.length).toBe(0);
    });
  });

  describe('includeCurrentPrices parameter', () => {
    it('succeeds when includeCurrentPrices is omitted (optional)', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });

    it('succeeds when includeCurrentPrices is true', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: true,
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });

    it('succeeds when includeCurrentPrices is false', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: false,
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });

    it('succeeds when includeCurrentPrices is string "true"', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: 'true',
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });

    it('succeeds when includeCurrentPrices is string "false"', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: 'false',
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });

    it('fails when includeCurrentPrices is not a boolean', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: 'yes',
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBeGreaterThan(0);
      expect(includeErrors[0].msg).toBe('includeCurrentPrices must be a boolean');
    });

    it('succeeds when includeCurrentPrices is 0 or 1 (isBoolean accepts numeric booleans)', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        includeCurrentPrices: 1,
      });
      const includeErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'includeCurrentPrices'
      );
      expect(includeErrors.length).toBe(0);
    });
  });

  describe('full validation scenarios', () => {
    it('succeeds with all required parameters', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with all parameters including optional', async () => {
      const result = await runValidations({
        id: 'ES000123',
        startDate: '2024-06-15',
        endDate: '2024-09-30',
        includeCurrentPrices: true,
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('fails with multiple errors when all required params are missing', async () => {
      const result = await runValidations({});
      const errors = result.array();
      expect(result.isEmpty()).toBe(false);
      // id, startDate, endDate should all fail
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
