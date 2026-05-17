import { Router } from 'express';
import { serviceStationsController } from '@/controllers/service-stations.controller';
import { municipalitiesController } from '@/controllers/municipalities.controller';
import { historicPricesController } from '@/controllers/historic-prices.controller';
import { healthcheckController } from '@/controllers/healthcheck.controller';
import { serviceStationsValidations } from '@/validations/service-stations.validation';
import { historicPricesValidations } from '@/validations/historic-prices.validation';
import { endpointDisabledMiddleware } from '@/middlewares/endpoint-disabled.middleware';
import { databaseConnectionMiddleware } from '@/middlewares/database-connection.middleware';

const router: Router = Router();

router.get(
  '/service-stations', 
  endpointDisabledMiddleware('DISABLE_SERVICE_STATIONS'), 
  serviceStationsValidations, 
  serviceStationsController,
);
router.get(
  '/historic-prices',
  endpointDisabledMiddleware('DISABLE_SERVICE_STATIONS_HISTORIC'),
  databaseConnectionMiddleware(),
  historicPricesValidations,
  historicPricesController,
);
router.get(
  '/municipalities', 
  endpointDisabledMiddleware('DISABLE_MUNICIPALITIES'), 
  municipalitiesController,
);
router.get(
  '/healthcheck', 
  healthcheckController,
);

router.use((_req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
  });
});

export default router;
