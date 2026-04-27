'use strict';

const { ensureNotificationPreferences } = require('../utils/notificationPreferences');

function createAttachCurrentUser(userModel) {
  return async function attachCurrentUser(req, _res, next) {
    if (!userModel || typeof userModel.findById !== 'function' || !req.user?.id) {
      return next();
    }

    try {
      const persistedUser = await userModel.findById(req.user.id);
      if (persistedUser) {
        req.user = {
          ...req.user,
          name: persistedUser.name || req.user.name || null,
          email: persistedUser.email || req.user.email || null,
          avatar: persistedUser.avatar || req.user.avatar || null,
          provider: persistedUser.provider || req.user.provider || null,
          role: persistedUser.role || req.user.role || 'viewer',
          notificationPreferences: ensureNotificationPreferences(persistedUser.notificationPreferences),
        };
      }
    } catch (_) {
      // Ignore hydration errors and continue with the decoded token payload.
    }

    return next();
  };
}

module.exports = createAttachCurrentUser;
