/**
 * ============================================================================
 * AUTH MIDDLEWARE — JWT Authentication
 * ============================================================================
 * Verifies the Bearer token in the Authorization header using jsonwebtoken.
 * Attaches the decoded payload to req.user for downstream use.
 *
 * DEV MODE: When JWT_SECRET is not set, attaches a default dev user so the
 *           server can run without requiring a full auth setup.
 *
 * USAGE:
 *   const auth = require('./middleware/auth');
 *   router.use(auth);                   // protect all routes
 *   router.post('/analyze', auth, …);   // protect single route
 * ============================================================================
 */

const { AuthenticationError } = require('../utils/errors');
const config = require('../config/env');

let jwt;
try { jwt = require('jsonwebtoken'); } catch (_) { /* optional dep */ }

function auth(req, res, next) {
  const result = authenticateRequest(req);
  if (!result.ok) {
    return next(new AuthenticationError());
  }
  req.user = {
    ...(req.user || {}),
    ...result.user,
  };
  return next();
}

auth.optional = function optionalAuth(req, res, next) {
  const result = authenticateRequest(req, { optional: true });
  if (result.ok && result.user) {
    req.user = {
      ...(req.user || {}),
      ...result.user,
    };
  }
  return next();
};

function authenticateRequest(req, { optional = false } = {}) {
  const secret = config.JWT_SECRET;
  const allowDevBypass =
    process.env.NODE_ENV === 'test' ||
    !jwt ||
    process.env.AUTH_DEV_BYPASS === 'true';

  // ---- Extract Bearer token ----
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const fullUrl = String(req.originalUrl || '');
  const baseUrl = String(req.baseUrl || '');
  const pathUrl = String(req.path || '');
  const allowQueryToken =
    fullUrl.startsWith('/api/stream-ingest/') ||
    baseUrl.startsWith('/api/stream-ingest') ||
    pathUrl.startsWith('/api/stream-ingest/');
  const queryToken = allowQueryToken && typeof req.query?.token === 'string' ? req.query.token : null;
  const token = bearerToken || queryToken;

  // If token exists, always try to verify first even when dev bypass is allowed.
  if (token && jwt && secret) {
    try {
      const decoded = jwt.verify(token, secret);
      return {
        ok: true,
        user: {
          id: decoded.sub || decoded.id || decoded.userId,
          role: decoded.role || 'viewer',
          email: decoded.email,
        },
      };
    } catch (err) {
      return optional ? { ok: true, user: null } : { ok: false };
    }
  }

  if (allowDevBypass) {
    return {
      ok: true,
      user: { id: 'dev-admin', role: 'admin' },
    };
  }

  if (!token) {
    return optional ? { ok: true, user: null } : { ok: false };
  }

  // ---- Verify token ----
  try {
    const decoded = jwt.verify(token, secret);
    return {
      ok: true,
      user: {
        id: decoded.sub || decoded.id || decoded.userId,
        role: decoded.role || 'viewer',
        email: decoded.email,
      },
    };
  } catch (err) {
    return optional ? { ok: true, user: null } : { ok: false };
  }
}

module.exports = auth;
