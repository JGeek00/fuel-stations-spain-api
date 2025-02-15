import { Router } from 'express';
import { serviceStationsController, serviceStationsValidations } from '@/controllers/service-stations.controller';
import { municipalitiesController } from '@/controllers/municipalities.controller';
import { historicPricesController, historicPricesValidations } from '@/controllers/historic-prices.controller';
import { healthcheckController } from '@/controllers/healthcheck.controller';

const router: Router = Router();

router.get('/service-stations', serviceStationsValidations, serviceStationsController)
router.get('/historic-prices', historicPricesValidations, historicPricesController)
router.get('/municipalities', municipalitiesController)
router.get('/healthcheck', healthcheckController)

router.get('*', (req, res) => {
  res.status(404).send("Endpoint not found")
})

export default router;