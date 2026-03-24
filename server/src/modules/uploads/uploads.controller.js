import { uploadsService } from './uploads.service.js';
import { success } from '../../utils/response.js';

export const uploadsController = {
  async uploadFile(req, res, next) {
    try {
      const result = await uploadsService.uploadImage(req.file);
      return success(res, result, 201);
    } catch (err) { next(err); }
  },

  async uploadBase64(req, res, next) {
    try {
      const { image } = req.body;
      const result = await uploadsService.uploadBase64(image);
      return success(res, result, 201);
    } catch (err) { next(err); }
  },
};
