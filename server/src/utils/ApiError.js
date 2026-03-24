export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'غير مصرح') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'غير مسموح') {
    return new ApiError(403, message);
  }

  static notFound(message = 'غير موجود') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static internal(message = 'خطأ داخلي في الخادم') {
    return new ApiError(500, message);
  }
}
