import { Router } from 'express';
import { serviceStationsController, serviceStationsValidations } from '@/controllers/service-stations.controller';
import { municipalitiesController } from '@/controllers/municipalities.controller';
import { serviceStationsHistoricController, serviceStationsHistoricValidations } from '@/controllers/service-stations-historic.controller';

const router: Router = Router();

router.get('/service-stations', serviceStationsValidations, serviceStationsController)
router.get('/service-stations-historic', serviceStationsHistoricValidations, serviceStationsHistoricController)
router.get('/municipalities', municipalitiesController)

router.get('*', (req, res) => {
  res.status(404).send("Endpoint not found")
})

export default router;