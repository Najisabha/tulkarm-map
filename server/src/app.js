import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import placeTypesRoutes from './modules/placeTypes/placeTypes.routes.js';
import placesRoutes from './modules/places/places.routes.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import ratingsRoutes, { placeRatingsRouter } from './modules/ratings/ratings.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import placeCategoriesRoutes from './modules/placeCategories/placeCategories.routes.js';
import complexesRoutes from './modules/complexes/complexes.routes.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Tulkarm Map API' });
});

// Auth
app.use('/api/auth', authRoutes);

// Places system
app.use('/api/place-types', placeTypesRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/places/:placeId/ratings', placeRatingsRouter);

// Upload
app.use('/api/upload', uploadsRoutes);

// Ratings
app.use('/api/ratings', ratingsRoutes);

// Admin (users, reports, activity, settings, stats)
app.use('/api', adminRoutes);

// Place categories (main/sub tree)
app.use('/api', placeCategoriesRoutes);

// Complexes & units
app.use('/api', complexesRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
