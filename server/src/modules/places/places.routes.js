import { Router } from 'express';
import { placesController } from './places.controller.js';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate, validateQuery } from '../../middleware/validate.middleware.js';
import { createPlaceSchema, updatePlaceSchema, placesQuerySchema } from './places.schema.js';

const router = Router();

router.get('/', optionalAuth, validateQuery(placesQuerySchema), placesController.getAll);
router.post(
  '/from-admin',
  authenticate,
  requireRole('admin'),
  validate(createPlaceSchema),
  placesController.createFromAdmin
);
router.get('/:id', optionalAuth, placesController.getById);
router.post('/', authenticate, validate(createPlaceSchema), placesController.create);
router.patch('/:id', authenticate, validate(updatePlaceSchema), placesController.update);
router.delete('/:id', authenticate, placesController.remove);
router.post('/:id/images', authenticate, placesController.addImage);
router.delete('/:id/images/:imageId', authenticate, placesController.removeImage);

export default router;
