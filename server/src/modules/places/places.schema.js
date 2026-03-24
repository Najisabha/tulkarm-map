import { z } from 'zod';

const attributeSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  value_type: z.enum(['string', 'number', 'boolean', 'json', 'date']).default('string'),
});

export const createPlaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type_id: z.string().uuid('معرّف نوع المكان يجب أن يكون UUID صالحاً من السيرفر'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  attributes: z.array(attributeSchema).optional(),
  image_urls: z.array(z.string().url('رابط صورة غير صالح')).max(10).optional(),
});

export const updatePlaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  type_id: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(['active', 'pending', 'rejected']).optional(),
  attributes: z.array(attributeSchema).optional(),
});

export const placesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  type: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(['active', 'pending', 'rejected', 'all']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'rating', 'distance']).default('newest'),
});
