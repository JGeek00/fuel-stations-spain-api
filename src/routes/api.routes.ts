import { Router } from 'express';
import { serviceStationsController } from '@/controllers/service-stations.controller';
import { municipalitiesController } from '@/controllers/municipalities.controller';
import { historicPricesController } from '@/controllers/historic-prices.controller';
import { healthcheckController } from '@/controllers/healthcheck.controller';
import { serviceStationsValidations } from '@/validations/service-stations/service-stations.validation';
import { historicPricesValidations } from '@/validations/historic-prices/historic-prices.validation';

const router: Router = Router();

router.get('/service-stations', serviceStationsValidations, serviceStationsController)
router.get('/historic-prices', historicPricesValidations, historicPricesController)
router.get('/municipalities', municipalitiesController)
router.get('/healthcheck', healthcheckController)

router.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
  });
});

export default router;
