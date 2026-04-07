/** يمنع فشل res.json عند وجود BigInt من node-pg (COUNT وغيره) */
function jsonSafe(value) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
    );
  } catch {
    return value;
  }
}

export function success(res, data = null, statusCode = 200) {
  const body = { success: true };
  if (data !== null) body.data = jsonSafe(data);
  return res.status(statusCode).json(body);
}

export function paginated(res, { data, page, limit, total }) {
  return res.status(200).json({
    success: true,
    data: jsonSafe(data),
    meta: {
      page,
      limit,
      total: typeof total === 'bigint' ? Number(total) : total,
      totalPages: Math.ceil(Number(total) / limit),
    },
  });
}
