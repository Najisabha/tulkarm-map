import { Router } from 'express';
import { ratingsController } from './ratings.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate, validateQuery } from '../../middleware/validate.middleware.js';
import { createRatingSchema, updateRatingSchema, ratingsQuerySchema } from './ratings.schema.js';

const router = Router();

router.post('/', authenticate, validate(createRatingSchema), ratingsController.create);
router.patch('/:id', authenticate, validate(updateRatingSchema), ratingsController.update);
router.delete('/:id', authenticate, ratingsController.remove);

export default router;

export const placeRatingsRouter = Router({ mergeParams: true });
placeRatingsRouter.get('/', validateQuery(ratingsQuerySchema), ratingsController.getByPlace);
