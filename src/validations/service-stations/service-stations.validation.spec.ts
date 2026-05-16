import { describe, it, expect } from 'vitest';
import { FieldValidationError, validationResult } from 'express-validator';
import type { Request } from 'express';
import { serviceStationsValidations } from './service-stations.validation';

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

  for (const chain of serviceStationsValidations) {
    await chain.run(mockReq);
  }

  return validationResult(mockReq);
}

describe('serviceStationsValidations', () => {
  describe('limit parameter', () => {
    it('succeeds when limit is omitted (optional)', async () => {
      const result = await runValidations({});
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBe(0);
    });

    it('succeeds when limit is a valid integer', async () => {
      const result = await runValidations({ limit: 50 });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBe(0);
    });

    it('succeeds when limit is a string integer', async () => {
      const result = await runValidations({ limit: '50' });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBe(0);
    });

    it('succeeds when limit is zero', async () => {
      const result = await runValidations({ limit: 0 });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBe(0);
    });

    it('fails when limit is a float', async () => {
      const result = await runValidations({ limit: 50.5 });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBeGreaterThan(0);
      expect(limitErrors[0].msg).toBe('Limit parameter must be an int value');
    });

    it('fails when limit is a non-numeric string', async () => {
      const result = await runValidations({ limit: 'not-a-number' });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBeGreaterThan(0);
      expect(limitErrors[0].msg).toBe('Limit parameter must be an int value');
    });

    it('fails when limit is a boolean', async () => {
      const result = await runValidations({ limit: true });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBeGreaterThan(0);
      expect(limitErrors[0].msg).toBe('Limit parameter must be an int value');
    });

    it('fails when limit is an object', async () => {
      const result = await runValidations({ limit: { value: 50 } });
      const limitErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'limit'
      );
      expect(limitErrors.length).toBeGreaterThan(0);
      expect(limitErrors[0].msg).toBe('Limit parameter must be an int value');
    });
  });

  describe('offset parameter', () => {
    it('succeeds when offset is omitted (optional)', async () => {
      const result = await runValidations({});
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBe(0);
    });

    it('succeeds when offset is a valid integer', async () => {
      const result = await runValidations({ offset: 100 });
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBe(0);
    });

    it('succeeds when offset is zero', async () => {
      const result = await runValidations({ offset: 0 });
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBe(0);
    });

    it('succeeds when offset is a negative integer', async () => {
      const result = await runValidations({ offset: -5 });
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBe(0);
    });

    it('fails when offset is a float', async () => {
      const result = await runValidations({ offset: 10.5 });
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBeGreaterThan(0);
      expect(offsetErrors[0].msg).toBe('Offset parameter must be an int value');
    });

    it('fails when offset is a non-numeric string', async () => {
      const result = await runValidations({ offset: 'abc' });
      const offsetErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'offset'
      );
      expect(offsetErrors.length).toBeGreaterThan(0);
      expect(offsetErrors[0].msg).toBe('Offset parameter must be an int value');
    });
  });

  describe('municipalityId parameter', () => {
    it('succeeds when municipalityId is omitted (optional)', async () => {
      const result = await runValidations({});
      const munErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'municipalityId'
      );
      expect(munErrors.length).toBe(0);
    });

    it('succeeds when municipalityId is a valid integer', async () => {
      const result = await runValidations({ municipalityId: 28079 });
      const munErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'municipalityId'
      );
      expect(munErrors.length).toBe(0);
    });

    it('succeeds when municipalityId is a string integer', async () => {
      const result = await runValidations({ municipalityId: '28079' });
      const munErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'municipalityId'
      );
      expect(munErrors.length).toBe(0);
    });

    it('fails when municipalityId is a string', async () => {
      const result = await runValidations({ municipalityId: 'madrid' });
      const munErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'municipalityId'
      );
      expect(munErrors.length).toBeGreaterThan(0);
      expect(munErrors[0].msg).toBe('MunicipalityId parameter must be an int value');
    });

    it('fails when municipalityId is a float', async () => {
      const result = await runValidations({ municipalityId: 28079.5 });
      const munErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'municipalityId'
      );
      expect(munErrors.length).toBeGreaterThan(0);
    });
  });

  describe('id parameter', () => {
    it('succeeds when id is omitted (optional)', async () => {
      const result = await runValidations({});
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('succeeds when id is a single string', async () => {
      const result = await runValidations({ id: 'ES000123' });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('succeeds when id is an array of strings', async () => {
      const result = await runValidations({ id: ['ES000123', 'ES000456', 'ES000789'] });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('succeeds when id is an array with a single string', async () => {
      const result = await runValidations({ id: ['ES000123'] });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('succeeds when id is an empty array', async () => {
      // Every on empty array returns true
      const result = await runValidations({ id: [] });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBe(0);
    });

    it('fails when id is a number', async () => {
      const result = await runValidations({ id: 12345 });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('fails when id is an array of numbers', async () => {
      const result = await runValidations({ id: [123, 456] });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('fails when id is an array with mixed types', async () => {
      const result = await runValidations({ id: ['ES000123', 456] });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('fails when id is a boolean', async () => {
      const result = await runValidations({ id: true });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });

    it('fails when id is an object', async () => {
      const result = await runValidations({ id: { stationId: 'ES000123' } });
      const idErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'id'
      );
      expect(idErrors.length).toBeGreaterThan(0);
    });
  });

  describe('coordinates parameter', () => {
    it('succeeds when coordinates is omitted (optional)', async () => {
      const result = await runValidations({});
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with valid Madrid coordinates', async () => {
      const result = await runValidations({ coordinates: '40.4168,-3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with valid Barcelona coordinates', async () => {
      const result = await runValidations({ coordinates: '41.3874,2.1686' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with negative coordinates (southwest)', async () => {
      const result = await runValidations({ coordinates: '-33.4489,-70.6693' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with coordinates at equator and prime meridian', async () => {
      const result = await runValidations({ coordinates: '0,0' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with coordinates at latitude boundary (+90)', async () => {
      const result = await runValidations({ coordinates: '90,180' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('succeeds with coordinates at latitude boundary (-90)', async () => {
      const result = await runValidations({ coordinates: '-90,-180' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBe(0);
    });

    it('fails when coordinates has no comma', async () => {
      const result = await runValidations({ coordinates: '40.4168-3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Both latitude and longitude are required');
    });

    it('fails when latitude is missing', async () => {
      const result = await runValidations({ coordinates: ',3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Both latitude and longitude are required');
    });

    it('fails when longitude is missing', async () => {
      const result = await runValidations({ coordinates: '40.4168,' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Both latitude and longitude are required');
    });

    it('fails when latitude is not a number', async () => {
      const result = await runValidations({ coordinates: 'abc,-3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Latitude must be a number between -90 and 90');
    });

    it('fails when longitude is not a number', async () => {
      const result = await runValidations({ coordinates: '40.4168,xyz' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Longitude must be a number between -180 and 180');
    });

    it('fails when latitude exceeds 90', async () => {
      const result = await runValidations({ coordinates: '91,-3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Latitude must be a number between -90 and 90');
    });

    it('fails when latitude is below -90', async () => {
      const result = await runValidations({ coordinates: '-91,-3.7038' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Latitude must be a number between -90 and 90');
    });

    it('fails when longitude exceeds 180', async () => {
      const result = await runValidations({ coordinates: '40.4168,181' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Longitude must be a number between -180 and 180');
    });

    it('fails when longitude is below -180', async () => {
      const result = await runValidations({ coordinates: '40.4168,-181' });
      const coordErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'coordinates'
      );
      expect(coordErrors.length).toBeGreaterThan(0);
      expect(coordErrors[0].msg).toBe('Longitude must be a number between -180 and 180');
    });
  });

  describe('distance parameter', () => {
    it('succeeds when distance is omitted (optional)', async () => {
      const result = await runValidations({});
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBe(0);
    });

    it('succeeds when distance is a valid integer', async () => {
      const result = await runValidations({ distance: 10 });
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBe(0);
    });

    it('succeeds when distance is a string integer', async () => {
      const result = await runValidations({ distance: '25' });
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBe(0);
    });

    it('succeeds when distance is zero', async () => {
      const result = await runValidations({ distance: 0 });
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBe(0);
    });

    it('fails when distance is a float', async () => {
      const result = await runValidations({ distance: 10.5 });
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBeGreaterThan(0);
      expect(distErrors[0].msg).toBe('Distance must be a number (min 10 Km, max 50 Km)');
    });

    it('fails when distance is a non-numeric string', async () => {
      const result = await runValidations({ distance: 'ten' });
      const distErrors = result.array().filter(
        (e): e is FieldValidationError =>
          e.type === 'field' && e.path === 'distance'
      );
      expect(distErrors.length).toBeGreaterThan(0);
      expect(distErrors[0].msg).toBe('Distance must be a number (min 10 Km, max 50 Km)');
    });
  });

  describe('full validation scenarios', () => {
    it('succeeds with no parameters (all optional)', async () => {
      const result = await runValidations({});
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with pagination parameters', async () => {
      const result = await runValidations({
        limit: 50,
        offset: 0,
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with search by municipality', async () => {
      const result = await runValidations({
        municipalityId: 28079,
        limit: 25,
        offset: 0,
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with search by coordinates and distance', async () => {
      const result = await runValidations({
        coordinates: '40.4168,-3.7038',
        distance: 10,
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with search by single id', async () => {
      const result = await runValidations({
        id: 'ES000123',
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with search by multiple ids', async () => {
      const result = await runValidations({
        id: ['ES000123', 'ES000456', 'ES000789'],
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('succeeds with full parameter set', async () => {
      const result = await runValidations({
        limit: 50,
        offset: 0,
        municipalityId: 28079,
        coordinates: '40.4168,-3.7038',
        distance: 25,
      });
      expect(result.isEmpty()).toBe(true);
    });

    it('fails with multiple validation errors', async () => {
      const result = await runValidations({
        limit: 'abc',
        offset: 10.5,
        municipalityId: 'madrid',
        distance: 'ten',
        coordinates: 'invalid',
      });
      const errors = result.array();

      expect(result.isEmpty()).toBe(false);
      // Should have errors for limit, offset, municipalityId, distance, coordinates
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});
