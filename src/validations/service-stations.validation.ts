import { query } from 'express-validator';

export const serviceStationsValidations = [
  query('limit').isInt().optional().withMessage('Limit parameter must be an int value'),
  query('offset').isInt().optional().withMessage('Offset parameter must be an int value'),
  query('municipalityId').isInt().optional().withMessage('MunicipalityId parameter must be an int value'),
  query('id')
    .optional()
    .custom(value => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        return true;
      }
      throw new Error('Id must be a string or an array of strings');
    }),
  query('coordinates')
    .optional()
    .custom((value) => {
      const [latitude, longitude] = value.split(',');
      if (!latitude || !longitude) {
        throw new Error('Both latitude and longitude are required');
      }
      const lat = parseFloat(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a number between -90 and 90');
      }
      const lon = parseFloat(longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error('Longitude must be a number between -180 and 180');
      }
      return true;
    }),
  query('distance').isInt().optional().withMessage('Distance must be a number (min 10 Km, max 50 Km)')
];
