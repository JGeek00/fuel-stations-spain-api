import { Router } from 'express';
import { serviceStationsController, serviceStationsValidations } from '@/controllers/service-stations.controller';
import { municipalitiesController } from '@/controllers/municipalities.controller';

const router: Router = Router();

router.get('/service-stations', serviceStationsValidations, serviceStationsController)
router.get('/municipalities', municipalitiesController)

router.get('*', (req, res) => {
  res.status(404).send("Endpoint not found")
})

export default router;