export function success(res, data = null, statusCode = 200) {
  const body = { success: true };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
}

export function paginated(res, { data, page, limit, total }) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
