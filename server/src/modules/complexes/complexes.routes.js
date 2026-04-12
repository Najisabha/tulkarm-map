import { Router } from 'express';
import pool from '../../config/db.js';
import { authenticate } from '../../middleware/auth.middleware.js';
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

// GET /api/complexes/residential/child-place-ids
// Returns all child_place_ids linked to residential complexes (for filtering in admin UI)
router.get('/complexes/residential/child-place-ids', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT cu.child_place_id
       FROM complex_units cu
       JOIN complexes c ON c.id = cu.complex_id
       JOIN places p ON p.id = cu.child_place_id AND p.deleted_at IS NULL
       WHERE c.complex_type = 'residential'
         AND cu.child_place_id IS NOT NULL`
    );
    return success(res, { child_place_ids: rows.map((r) => r.child_place_id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/complexes/commercial/child-place-ids
// Returns all child_place_ids linked to commercial complexes (for filtering in admin UI)
router.get('/complexes/commercial/child-place-ids', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT cu.child_place_id
       FROM complex_units cu
       JOIN complexes c ON c.id = cu.complex_id
       JOIN places p ON p.id = cu.child_place_id AND p.deleted_at IS NULL
       WHERE c.complex_type = 'commercial'
         AND cu.child_place_id IS NOT NULL`
    );
    return success(res, { child_place_ids: rows.map((r) => r.child_place_id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/complexes/:placeId
router.get('/complexes/:placeId', authenticate, async (req, res, next) => {
  try {
    const complex = await ensureComplex(req.params.placeId);
    if (!complex) throw ApiError.notFound('هذا المكان ليس مجمعاً');
    const { rows: units } = await pool.query(
      `SELECT cu.id, cu.complex_id, cu.floor_number, cu.unit_number,
              cu.child_place_id, cu.created_at,
              p.name AS child_place_name
       FROM complex_units cu
       LEFT JOIN places p ON p.id = cu.child_place_id AND p.deleted_at IS NULL
       WHERE cu.complex_id = $1
       ORDER BY cu.floor_number, cu.unit_number`,
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
      `SELECT cu.id, cu.complex_id, cu.floor_number, cu.unit_number,
              cu.child_place_id, cu.created_at,
              p.name AS child_place_name
       FROM complex_units cu
       LEFT JOIN places p ON p.id = cu.child_place_id AND p.deleted_at IS NULL
       WHERE cu.complex_id = $1
       ORDER BY cu.floor_number, cu.unit_number`,
      [complex.id]
    );
    return success(res, { message: 'تم إنشاء الوحدات', units });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/complex-units/:id/link-place
// يربط وحدة بمكان تابع (child_place_id) — admin أو منشئ المجمع/البيت
router.patch('/complex-units/:id/link-place', authenticate, async (req, res, next) => {
  try {
    const unitId = req.params.id;
    const childPlaceId = req.body?.child_place_id ? String(req.body.child_place_id) : null;

    const { rows: uRows } = await pool.query(
      `SELECT cu.id, cu.complex_id, c.place_id as parent_place_id
       FROM complex_units cu
       JOIN complexes c ON c.id = cu.complex_id
       WHERE cu.id = $1`,
      [unitId]
    );
    if (!uRows[0]) throw ApiError.notFound('الوحدة غير موجودة');

    // Permission: admin or creator of the parent complex
    const parentPlaceId = uRows[0].parent_place_id;
    if (req.user.role !== 'admin') {
      const { rows: parentRows } = await pool.query(
        'SELECT created_by FROM places WHERE id = $1 AND deleted_at IS NULL',
        [parentPlaceId]
      );
      const isParentCreator = parentRows[0]?.created_by === req.user.id;

      let isChildCreator = false;
      if (childPlaceId) {
        const { rows: childRows } = await pool.query(
          'SELECT created_by FROM places WHERE id = $1 AND deleted_at IS NULL',
          [childPlaceId]
        );
        isChildCreator = childRows[0]?.created_by === req.user.id;
      }

      if (!isParentCreator && !isChildCreator) {
        throw ApiError.forbidden('لا يمكنك ربط/فك ربط هذه الوحدة');
      }
    }

    if (childPlaceId) {
      const { rows: pRows } = await pool.query('SELECT id FROM places WHERE id = $1 AND deleted_at IS NULL', [childPlaceId]);
      if (!pRows[0]) throw ApiError.notFound('المكان التابع غير موجود');

      const { rows: asComplex } = await pool.query('SELECT 1 FROM complexes WHERE place_id = $1 LIMIT 1', [childPlaceId]);
      if (asComplex[0]) {
        throw ApiError.badRequest('لا يمكن ربط وحدة بمكان يمثّل مجمّعاً تجارياً أو سكنياً. اختر نوعاً آخر.');
      }
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

