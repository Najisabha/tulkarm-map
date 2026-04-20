import { Router } from 'express';
import { placeTypesController } from './placeTypes.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createPlaceTypeSchema,
  updatePlaceTypeSchema,
  createAttributeDefSchema,
  updateAttributeDefSchema,
} from './placeTypes.schema.js';

const router = Router();

router.get('/', placeTypesController.getAll);
router.post('/', authenticate, requireRole('admin'), validate(createPlaceTypeSchema), placeTypesController.create);
router.patch('/:id', authenticate, requireRole('admin'), validate(updatePlaceTypeSchema), placeTypesController.update);
router.delete('/:id', authenticate, requireRole('admin'), placeTypesController.remove);
router.get('/:id/attribute-definitions', placeTypesController.getAttributeDefinitions);
router.post('/:id/attribute-definitions', authenticate, requireRole('admin'), validate(createAttributeDefSchema), placeTypesController.addAttributeDefinition);
router.patch(
  '/:id/attribute-definitions/:defId',
  authenticate,
  requireRole('admin'),
  validate(updateAttributeDefSchema),
  placeTypesController.updateAttributeDefinition
);
router.delete(
  '/:id/attribute-definitions/:defId',
  authenticate,
  requireRole('admin'),
  placeTypesController.removeAttributeDefinition
);

export default router;
