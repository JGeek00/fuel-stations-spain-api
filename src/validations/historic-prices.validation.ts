import { query } from 'express-validator';

export const historicPricesValidations = [
  query('id')
    .exists().withMessage('The id parameter is required')
    .bail()
    .custom((_, { req }) => {
      if (Array.isArray(req.query?.id)) {
        throw new Error('Only one id parameter is allowed');
      }
      return true;
    }),
  query('startDate').exists().isDate({ format: 'yyyy-mm-dd' }).withMessage('The startDate parameter is required and must be a date with format yyyy-mm-dd'),
  query('endDate').exists().isDate({ format: 'yyyy-mm-dd' }).withMessage('The endDate parameter is required and must be a date yyyy-mm-dd'),
  query('includeCurrentPrices').optional().isBoolean().withMessage('includeCurrentPrices must be a boolean')
];
