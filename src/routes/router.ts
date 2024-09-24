import { Router } from 'express';
import { serviceStationsController, serviceStationsValidations } from '../controllers/service-stations.controller';

const router: Router = Router();

router.get('/service-stations', serviceStationsValidations, serviceStationsController)

router.get('*', (req, res) => {
  res.status(404).send("Endpoint not found")
})

export default router;