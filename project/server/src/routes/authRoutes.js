/**
 * ============================================================================
 * AUTH ROUTES — /api/auth/*
 * ============================================================================
 * Public routes:
 *   POST /api/auth/register  — Create account with email/password
 *   POST /api/auth/login     — Sign in with email/password
 *   POST /api/auth/google    — Sign in / sign up with Google ID token
 *
 * Protected routes (require valid JWT):
 *   GET  /api/auth/me        — Fetch the current user's profile
 * ============================================================================
 */

const express = require('express');
const auth = require('../middleware/auth');

function createAuthRoutes({ userModel }) {
  const router = express.Router();
  const createAuthController = require('../controllers/authController');
  const controller = createAuthController({ userModel });

  // Public endpoints (no JWT required)
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/google', controller.googleAuth);

  // Protected endpoints (JWT required)
  router.get('/me', auth, controller.getProfile);
  router.put('/notifications', auth, controller.updateNotificationPreferences);
  router.post('/notifications/test-email', auth, controller.sendTestEmail);
  router.get('/user-data', auth, controller.getUserData);
  router.get('/user-data/:collection', auth, controller.getUserCollectionData);
  router.put('/update-profile', auth, controller.updateProfile);

  return router;
}

module.exports = createAuthRoutes;
