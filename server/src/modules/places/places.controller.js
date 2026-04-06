import { placesService } from './places.service.js';
import { success, paginated } from '../../utils/response.js';

function isAdmin(req) {
  return req.user?.role === 'admin';
}

export const placesController = {
  /** إضافة من الخريطة / الزائر — دائماً في طلبات المتاجر (pending) */
  async create(req, res, next) {
    try {
      const place = await placesService.create(req.validated, req.user ?? { role: 'guest' }, {
        publishDirectly: false,
      });
      return success(res, place, 201);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7310/ingest/7168c5ca-ca5c-43c5-be0d-5064499bc23f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7f4b9d'},body:JSON.stringify({sessionId:'7f4b9d',runId:'pre-fix',hypothesisId:'H4',location:'places.controller.js:create',message:'create_failed',data:{errName:err?.name,errMsg:String(err?.message||'').slice(0,200),pgCode:err?.code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      next(err);
    }
  },

  /** إضافة من لوحة الإدارة — نشر مباشر active (يحتاج JWT مدير) */
  async createFromAdmin(req, res, next) {
    try {
      const place = await placesService.create(req.validated, req.user, { publishDirectly: true });
      return success(res, place, 201);
    } catch (err) { next(err); }
  },

  async getAll(req, res, next) {
    try {
      const v = req.validatedQuery;
      let query = { ...v };

      if (!v.status) {
        query = { ...query, status: 'active' };
      } else if (v.status === 'all') {
        if (isAdmin(req)) {
          const { status: _omitted, ...rest } = query;
          query = rest;
        } else {
          query = { ...query, status: 'active' };
        }
      } else if (!isAdmin(req)) {
        query = { ...query, status: 'active' };
      }

      const result = await placesService.getMany(query);
      return paginated(res, result);
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const place = await placesService.getById(req.params.id, req.user);
      return success(res, place);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const place = await placesService.update(req.params.id, req.validated, req.user);
      if (place === null) {
        return success(res, { message: 'تم رفض الطلب وحذفه' });
      }
      return success(res, place);
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await placesService.remove(req.params.id, req.user);
      return success(res, { message: 'تم حذف المكان' });
    } catch (err) { next(err); }
  },

  async addImage(req, res, next) {
    try {
      const { image_url } = req.body;
      if (!image_url) return next(new Error('image_url is required'));
      const image = await placesService.addImage(req.params.id, image_url, req.user);
      return success(res, image, 201);
    } catch (err) { next(err); }
  },

  async removeImage(req, res, next) {
    try {
      await placesService.removeImage(req.params.id, req.params.imageId, req.user);
      return success(res, { message: 'تم حذف الصورة' });
    } catch (err) { next(err); }
  },
};
