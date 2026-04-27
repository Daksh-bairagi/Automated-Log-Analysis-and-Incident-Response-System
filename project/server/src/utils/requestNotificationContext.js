'use strict';

const { ensureNotificationPreferences } = require('./notificationPreferences');
const { isValidEmail, normalizeEmail } = require('./email');

function resolveRequestNotificationContext(user = {}) {
  const savedPreferences = ensureNotificationPreferences(user.notificationPreferences);
  const registeredEmail = normalizeEmail(user.email);
  const usableRegisteredEmail = isValidEmail(registeredEmail) ? registeredEmail : '';

  if (!savedPreferences.enabled) {
    return {
      notificationRecipientEmail: null,
      notificationPreferences: {
        ...savedPreferences,
        email: '',
      },
    };
  }

  return {
    notificationRecipientEmail: usableRegisteredEmail || null,
    notificationPreferences: {
      ...savedPreferences,
      email: usableRegisteredEmail,
    },
  };
}

module.exports = {
  resolveRequestNotificationContext,
};
