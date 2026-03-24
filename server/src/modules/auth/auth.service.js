import pool from '../../config/db.js';
import { authRepo } from './auth.repository.js';
import { hashPassword, verifyPassword, hashToken } from '../../utils/hash.js';
import { signAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '../../utils/jwt.js';
import { ApiError } from '../../utils/ApiError.js';

/** البريد الافتراضي للمدير — يُضمن role=admin في DB وJWT حتى لو بقي role قديماً user */
const DEFAULT_ADMIN_EMAIL = 'admin@tulkarm.com';

async function resolveEffectiveRole(user) {
  if (!user?.email) return user.role;
  if (user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL) return user.role;
  if (user.role === 'admin') return 'admin';
  await pool.query(
    `UPDATE users SET role = 'admin', updated_at = now() WHERE id = $1 AND (role IS DISTINCT FROM 'admin')`,
    [user.id]
  );
  return 'admin';
}

async function issueTokens(user) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = generateRefreshToken();
  const refreshHash = hashToken(rawRefresh);
  await authRepo.saveRefreshToken({
    userId: user.id,
    tokenHash: refreshHash,
    expiresAt: getRefreshTokenExpiry(),
  });
  return { accessToken, refreshToken: rawRefresh };
}

export const authService = {
  async register({ name, email, password }) {
    const existing = await authRepo.findUserByEmail(email);
    if (existing) throw ApiError.conflict('هذا البريد الإلكتروني مسجل مسبقاً');

    const passwordHash = await hashPassword(password);
    const user = await authRepo.createUser({ name, email, passwordHash });
    const tokens = await issueTokens(user);

    return { user, ...tokens };
  },

  async login({ email, password }) {
    const user = await authRepo.findUserByEmail(email);
    if (!user) throw ApiError.unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw ApiError.unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة');

    const effectiveRole = await resolveEffectiveRole(user);
    const tokens = await issueTokens({
      id: user.id,
      role: effectiveRole,
    });

    const { password_hash: _, ...rest } = user;
    const safeUser = { ...rest, role: effectiveRole };
    return { user: safeUser, ...tokens };
  },

  async refresh(rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await authRepo.findValidRefreshToken(tokenHash);
    if (!stored) throw ApiError.unauthorized('رمز التحديث غير صالح أو منتهي');

    await authRepo.revokeRefreshToken(tokenHash);

    const userRow = await authRepo.findUserById(stored.user_id);
    const effectiveRole = userRow ? await resolveEffectiveRole(userRow) : stored.role;

    const tokens = await issueTokens({
      id: stored.user_id,
      role: effectiveRole,
    });

    return tokens;
  },

  async logout(rawRefreshToken) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await authRepo.revokeRefreshToken(tokenHash);
    }
  },

  async getMe(userId) {
    const user = await authRepo.findUserById(userId);
    if (!user) throw ApiError.notFound('المستخدم غير موجود');
    return user;
  },
};
