import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const uploadsService = {
  async uploadImage(file) {
    if (!file) throw ApiError.badRequest('لم يتم اختيار صورة');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw ApiError.badRequest('نوع الملف غير مدعوم. استخدم JPEG, PNG, WebP, أو GIF');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw ApiError.badRequest('حجم الصورة يجب أن يكون أقل من 5 ميغابايت');
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'tulkarm-map',
            transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      throw ApiError.internal('فشل رفع الصورة: ' + err.message);
    }
  },

  async uploadBase64(base64Data) {
    if (!base64Data) throw ApiError.badRequest('لم يتم إرسال بيانات الصورة');

    try {
      const result = await cloudinary.uploader.upload(base64Data, {
        folder: 'tulkarm-map',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      throw ApiError.internal('فشل رفع الصورة: ' + err.message);
    }
  },

  async deleteImage(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Failed to delete from Cloudinary:', err.message);
    }
  },
};
