import { Router } from 'express';
import multer from 'multer';
import { uploadsController } from './uploads.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

router.post('/', authenticate, upload.single('image'), uploadsController.uploadFile);
router.post('/base64', authenticate, uploadsController.uploadBase64);

export default router;
