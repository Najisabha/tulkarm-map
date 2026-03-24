import { ApiError } from '../utils/ApiError.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('يجب تسجيل الدخول'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('ليس لديك صلاحية لهذا الإجراء'));
    }
    next();
  };
}
