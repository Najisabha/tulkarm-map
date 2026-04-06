import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { ApiError } from '../../utils/ApiError.js';
import { success } from '../../utils/response.js';

const router = Router();

function toInt(value, fallback) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureComplex(placeId) {
  const { rows } = await pool.query('SELECT * FROM complexes WHERE place_id = $1', [placeId]);
  return rows[0] || null;
}

async function ensureCanEdit(placeId, user) {
  // يسمح للـ admin أو منشئ المكان
  const { rows } = await pool.query('SELECT id, created_by FROM places WHERE id = $1 AND deleted_at IS NULL', [placeId]);
  const p = rows[0];
  if (!p) throw ApiError.notFound('المكان غير موجود');
  if (user.role === 'admin') return;
  if (!user?.id || p.created_by !== user.id) throw ApiError.forbidden('لا يمكنك تعديل هذا المكان');
}

// GET /api/complexes/:placeId
router.get('/complexes/:placeId', authenticate, async (req, res, next) => {
  try {
    const complex = await ensureComplex(req.params.placeId);
    if (!complex) throw ApiError.notFound('هذا المكان ليس مجمعاً');
    const { rows: units } = await pool.query(
      `SELECT id, complex_id, floor_number, unit_number, child_place_id, created_at
       FROM complex_units WHERE complex_id = $1
       ORDER BY floor_number, unit_number`,
      [complex.id]
    );
    return success(res, { complex, units });
  } catch (err) {
    next(err);
  }
});

// POST /api/complexes/:placeId/generate-units
// body: { floors_count, units_per_floor } — ينشئ الوحدات إذا لم تكن موجودة
router.post('/complexes/:placeId/generate-units', authenticate, async (req, res, next) => {
  try {
    const placeId = req.params.placeId;
    await ensureCanEdit(placeId, req.user);

    const complex = await ensureComplex(placeId);
    if (!complex) throw ApiError.notFound('هذا المكان ليس مجمعاً');

    const floorsCount = toInt(req.body?.floors_count, complex.floors_count || 1);
    const unitsPerFloor = toInt(req.body?.units_per_floor, complex.units_per_floor || 1);
    if (floorsCount < 1 || floorsCount > 200) throw ApiError.badRequest('عدد الطوابق غير صالح');
    if (unitsPerFloor < 1 || unitsPerFloor > 500) throw ApiError.badRequest('عدد الوحدات غير صالح');

    await pool.query(
      `UPDATE complexes SET floors_count = $2, units_per_floor = $3, updated_at = now() WHERE id = $1`,
      [complex.id, floorsCount, unitsPerFloor]
    );

    // إنشاء الوحدات بشكل idempotent (ON CONFLICT DO NOTHING)
    const insertValues = [];
    const params = [complex.id];
    let i = 2;
    for (let floor = 1; floor <= floorsCount; floor++) {
      for (let u = 1; u <= unitsPerFloor; u++) {
        const unitNo = String(u);
        insertValues.push(`($1, $${i++}, $${i++})`);
        params.push(floor, unitNo);
      }
    }
    if (insertValues.length > 0) {
      await pool.query(
        `INSERT INTO complex_units (complex_id, floor_number, unit_number)
         VALUES ${insertValues.join(', ')}
         ON CONFLICT (complex_id, floor_number, unit_number) DO NOTHING`,
        params
      );
    }

    const { rows: units } = await pool.query(
      `SELECT id, complex_id, floor_number, unit_number, child_place_id, created_at
       FROM complex_units WHERE complex_id = $1
       ORDER BY floor_number, unit_number`,
      [complex.id]
    );
    return success(res, { message: 'تم إنشاء الوحدات', units });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/complex-units/:id/link-place (admin)
// يربط وحدة بمكان تابع (child_place_id)
router.patch('/complex-units/:id/link-place', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const unitId = req.params.id;
    const childPlaceId = req.body?.child_place_id ? String(req.body.child_place_id) : null;

    const { rows: uRows } = await pool.query('SELECT id FROM complex_units WHERE id = $1', [unitId]);
    if (!uRows[0]) throw ApiError.notFound('الوحدة غير موجودة');

    if (childPlaceId) {
      const { rows: pRows } = await pool.query('SELECT id FROM places WHERE id = $1 AND deleted_at IS NULL', [childPlaceId]);
      if (!pRows[0]) throw ApiError.notFound('المكان التابع غير موجود');
    }

    const { rows } = await pool.query(
      `UPDATE complex_units SET child_place_id = $2 WHERE id = $1 RETURNING *`,
      [unitId, childPlaceId]
    );
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

