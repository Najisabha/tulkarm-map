import { authService } from './auth.service.js';
import { success } from '../../utils/response.js';

export const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.validated);
      return success(res, result, 201);
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.validated);
      return success(res, result);
    } catch (err) { next(err); }
  },

  async refresh(req, res, next) {
    try {
      const result = await authService.refresh(req.validated.refreshToken);
      return success(res, result);
    } catch (err) { next(err); }
  },

  async logout(req, res, next) {
    try {
      await authService.logout(req.body?.refreshToken);
      return success(res, { message: 'تم تسجيل الخروج' });
    } catch (err) { next(err); }
  },

  async me(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      return success(res, { user });
    } catch (err) { next(err); }
  },

  async updateProfile(req, res, next) {
    try {
      const result = await authService.updateProfile(req.user.id, req.validated);
      return success(res, result);
    } catch (err) { next(err); }
  },

  async changePassword(req, res, next) {
    try {
      const result = await authService.changePassword(req.user.id, req.validated);
      return success(res, result);
    } catch (err) { next(err); }
  },
};
