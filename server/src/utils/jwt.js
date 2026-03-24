import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function getRefreshTokenExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);
  return d;
}
