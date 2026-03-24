import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

export function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('يجب تسجيل الدخول');
    }
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized('رمز الوصول غير صالح أو منتهي'));
  }
}

export function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    }
  } catch {
    // ignore invalid token, proceed as unauthenticated
  }
  next();
}
