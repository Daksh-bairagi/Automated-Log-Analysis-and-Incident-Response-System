'use strict';

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: false,
  email: '',
  googleChatWebhookUrl: '',
  emailSmtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    passwordEncrypted: '',
  },
});

function normalizeNotificationPreferences(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const smtpSource = source.emailSmtp && typeof source.emailSmtp === 'object'
    ? source.emailSmtp
    : {};
  const port = parseInt(smtpSource.port, 10);

  return {
    enabled: Boolean(source.enabled),
    email: typeof source.email === 'string' ? source.email.trim().toLowerCase() : '',
    googleChatWebhookUrl:
      typeof source.googleChatWebhookUrl === 'string'
        ? source.googleChatWebhookUrl.trim()
        : '',
    emailSmtp: {
      host: typeof smtpSource.host === 'string' ? smtpSource.host.trim() : '',
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure: Boolean(smtpSource.secure),
      user: typeof smtpSource.user === 'string' ? smtpSource.user.trim().toLowerCase() : '',
      passwordEncrypted:
        typeof smtpSource.passwordEncrypted === 'string'
          ? smtpSource.passwordEncrypted.trim()
          : '',
    },
  };
}

function ensureNotificationPreferences(input = {}) {
  return normalizeNotificationPreferences({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(input && typeof input === 'object' ? input : {}),
  });
}

module.exports = {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  ensureNotificationPreferences,
};
