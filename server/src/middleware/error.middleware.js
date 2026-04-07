import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  console.error('Unhandled error:', err);
  const body = {
    success: false,
    message: 'خطأ داخلي في الخادم',
  };
  if (env.EXPOSE_INTERNAL_ERRORS) {
    body.debug = {
      pgCode: err?.code,
      message: String(err?.message || '').slice(0, 500),
    };
  }
  return res.status(500).json(body);
}

export function notFoundHandler(_req, _res, next) {
  next(ApiError.notFound('المسار غير موجود'));
}
