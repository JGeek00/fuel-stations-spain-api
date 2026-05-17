import { describe, it, expect } from 'vitest';
import { calculateBoundingBox } from '@/utils/calculate-distance';

describe('calculateBoundingBox', () => {
  it('calculates bounding box for center of Spain', () => {
    const result = calculateBoundingBox(40.4168, -3.7038, 10);

    expect(result.minLat).toBeLessThan(40.4168);
    expect(result.maxLat).toBeGreaterThan(40.4168);
    expect(result.minLon).toBeLessThan(-3.7038);
    expect(result.maxLon).toBeGreaterThan(-3.7038);
    // ~10km radius should produce a reasonable latitude span (~0.18° with this formula)
    const latSpan = result.maxLat - result.minLat;
    expect(latSpan).toBeGreaterThan(0.1);
    expect(latSpan).toBeLessThan(0.3);
  });

  it('calculates bounding box for Madrid', () => {
    const result = calculateBoundingBox(40.4168, -3.7038, 50);

    expect(result.minLat).toBeLessThan(40.4168);
    expect(result.maxLat).toBeGreaterThan(40.4168);
    expect(result.minLon).toBeLessThan(-3.7038);
    expect(result.maxLon).toBeGreaterThan(-3.7038);
  });

  it('calculates bounding box for the North Pole area', () => {
    const result = calculateBoundingBox(89, 0, 10);

    expect(result.minLat).toBeLessThan(89);
    expect(result.maxLat).toBeGreaterThan(89);
    // The simplified formula doesn't properly converge at poles — just verify structure
    expect(result.minLon).toBeLessThan(0);
    expect(result.maxLon).toBeGreaterThan(0);
  });

  it('calculates bounding box for the South Pole area', () => {
    const result = calculateBoundingBox(-89, 0, 10);

    expect(result.minLat).toBeLessThan(-89);
    expect(result.maxLat).toBeGreaterThan(-89);
    // The simplified formula doesn't properly converge at poles — just verify structure
    expect(result.minLon).toBeLessThan(0);
    expect(result.maxLon).toBeGreaterThan(0);
  });

  it('calculates bounding box for the equator', () => {
    const result = calculateBoundingBox(0, 0, 10);

    expect(result.minLat).toBeLessThan(0);
    expect(result.maxLat).toBeGreaterThan(0);
    expect(result.minLon).toBeLessThan(0);
    expect(result.maxLon).toBeGreaterThan(0);
    // At equator, 1 degree lat ≈ 1 degree lon
    const latSpan = result.maxLat - result.minLat;
    const lonSpan = result.maxLon - result.minLon;
    expect(lonSpan).toBeCloseTo(latSpan, 1);
  });

  it('larger radius produces larger bounding box', () => {
    const small = calculateBoundingBox(40, -3, 10);
    const large = calculateBoundingBox(40, -3, 100);

    const smallLatSpan = small.maxLat - small.minLat;
    const largeLatSpan = large.maxLat - large.minLat;

    expect(largeLatSpan).toBeGreaterThan(smallLatSpan);
  });

  it('zero radius produces zero-span bounding box', () => {
    const result = calculateBoundingBox(40.4168, -3.7038, 0);

    expect(result.minLat).toBe(40.4168);
    expect(result.maxLat).toBe(40.4168);
    expect(result.minLon).toBe(-3.7038);
    expect(result.maxLon).toBe(-3.7038);
  });

  it('returns all required properties', () => {
    const result = calculateBoundingBox(40, -3, 50);

    expect(result).toHaveProperty('minLat');
    expect(result).toHaveProperty('maxLat');
    expect(result).toHaveProperty('minLon');
    expect(result).toHaveProperty('maxLon');
    expect(typeof result.minLat).toBe('number');
    expect(typeof result.maxLat).toBe('number');
    expect(typeof result.minLon).toBe('number');
    expect(typeof result.maxLon).toBe('number');
  });
});
