'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../src/config/env');
const createAuthController = require('../../src/controllers/authController');
const EmailChannel = require('../../src/services/notification/channels/EmailChannel');
const GoogleChatChannel = require('../../src/services/notification/channels/GoogleChatChannel');

const FIXED_TEST_SMTP_USER = config.SMTP_USER || 'helloarav82@gmail.com';
const SMTP_CONFIGURED = Boolean(config.SMTP_PASS);
const RESEND_CONFIGURED = Boolean(config.RESEND_API_KEY && config.RESEND_FROM_EMAIL);
const EMAIL_CONFIGURED = SMTP_CONFIGURED || RESEND_CONFIGURED;
const DEFAULT_EMAIL_CAPABILITY_MESSAGE = RESEND_CONFIGURED
  ? `Email delivery uses Resend API sender ${config.RESEND_FROM_EMAIL}.`
  : SMTP_CONFIGURED
    ? `Email delivery uses fixed sender ${FIXED_TEST_SMTP_USER}.`
    : 'Email delivery is unavailable until SMTP or Resend is configured in server/.env.';

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function makeScryptHash(password, salt = 'fixed-salt-for-tests') {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

describe('authController', () => {
  beforeEach(() => {
    jest.spyOn(EmailChannel.prototype, 'getCapability').mockResolvedValue({
      available: EMAIL_CONFIGURED,
      message: DEFAULT_EMAIL_CAPABILITY_MESSAGE,
    });
    jest.spyOn(GoogleChatChannel.prototype, 'isEnabled').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('register creates a new analyst account and returns a token', async () => {
    const userModel = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        _id: 'user-1',
        name: 'Asha',
        email: 'asha@example.com',
        role: 'analyst',
        provider: 'local',
        createdAt: '2026-04-15T00:00:00.000Z',
      }),
    };
    const controller = createAuthController({ userModel });
    const req = {
      body: {
        name: 'Asha',
        email: 'Asha@example.com',
        password: 'secret123',
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.register(req, res, next);

    expect(userModel.findByEmail).toHaveBeenCalledWith('Asha@example.com');
    expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Asha',
      email: 'Asha@example.com',
      provider: 'local',
      role: 'analyst',
      password: expect.any(String),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      token: expect.any(String),
      user: expect.objectContaining({
        email: 'asha@example.com',
        role: 'analyst',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('login upgrades legacy viewer role to analyst and returns jwt payload with analyst role', async () => {
    const password = 'secret123';
    const passwordHash = makeScryptHash(password);
    const upgradedUser = {
      _id: 'user-2',
      name: 'Legacy User',
      email: 'legacy@example.com',
      password: passwordHash,
      role: 'analyst',
      provider: 'local',
      createdAt: '2026-04-15T00:00:00.000Z',
    };
    const userModel = {
      findByEmail: jest.fn().mockResolvedValue({
        ...upgradedUser,
        role: 'viewer',
      }),
      updateById: jest.fn().mockResolvedValue(upgradedUser),
    };
    const controller = createAuthController({ userModel });
    const req = {
      body: {
        email: 'legacy@example.com',
        password,
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.login(req, res, next);

    expect(userModel.updateById).toHaveBeenCalledWith('user-2', { role: 'analyst' });
    const [{ token }] = res.json.mock.calls[0];
    const decoded = jwt.decode(token);
    expect(decoded.role).toBe('analyst');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        email: 'legacy@example.com',
        role: 'analyst',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('getProfile returns auth error when user does not exist', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const controller = createAuthController({ userModel });
    const req = { user: { id: 'missing-user' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getProfile(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AUTH_REQUIRED',
      statusCode: 401,
    }));
    expect(res.json).not.toHaveBeenCalled();
  });

  test('getProfile returns normalized notification preferences', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'user-3',
        name: 'Rina',
        email: 'rina@example.com',
        role: 'analyst',
        provider: 'local',
        notificationPreferences: {
          enabled: true,
          email: 'RINA.ALERTS@EXAMPLE.COM',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
        },
        createdAt: '2026-04-15T00:00:00.000Z',
      }),
    };
    const controller = createAuthController({ userModel });
    const req = { user: { id: 'user-3' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getProfile(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          enabled: true,
          email: 'rina.alerts@example.com',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
          emailSmtp: expect.objectContaining({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            user: FIXED_TEST_SMTP_USER,
            passwordConfigured: SMTP_CONFIGURED,
          }),
        }),
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('updateNotificationPreferences saves validated Google Chat settings and returns the updated user', async () => {
    const updatedUser = {
      _id: 'user-4',
      name: 'Nila',
      email: 'nila@example.com',
      role: 'analyst',
      provider: 'local',
      notificationPreferences: {
        enabled: true,
        email: 'nila@example.com',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      },
      createdAt: '2026-04-15T00:00:00.000Z',
    };
    const userModel = {
      findById: jest.fn().mockResolvedValue(updatedUser),
      updateById: jest.fn().mockResolvedValue(updatedUser),
    };
    const controller = createAuthController({ userModel });
    const req = {
      user: { id: 'user-4' },
      body: {
        notificationPreferences: {
          enabled: true,
          email: '',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
        },
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.updateNotificationPreferences(req, res, next);

    expect(userModel.updateById).toHaveBeenCalledWith('user-4', {
      notificationPreferences: expect.objectContaining({
        enabled: true,
        email: 'nila@example.com',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      }),
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          enabled: true,
          email: 'nila@example.com',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
        }),
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('updateNotificationPreferences keeps fixed SMTP metadata even if SMTP input is submitted', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'user-4b',
        name: 'Nila',
        email: 'nila@example.com',
        role: 'analyst',
        provider: 'local',
        notificationPreferences: {
          enabled: false,
          email: '',
          googleChatWebhookUrl: '',
        },
        createdAt: '2026-04-15T00:00:00.000Z',
      }),
      updateById: jest.fn().mockImplementation(async (id, update) => ({
        _id: id,
        name: 'Nila',
        email: 'nila@example.com',
        role: 'analyst',
        provider: 'local',
        notificationPreferences: update.notificationPreferences,
        createdAt: '2026-04-15T00:00:00.000Z',
      })),
    };
    const controller = createAuthController({ userModel });
    const req = {
      user: { id: 'user-4b' },
      body: {
        notificationPreferences: {
          enabled: true,
          email: '',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
          emailSmtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            user: 'NILA@EXAMPLE.COM',
            password: 'gmail-app-password',
          },
        },
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.updateNotificationPreferences(req, res, next);

    const savedPreferences = userModel.updateById.mock.calls[0][1].notificationPreferences;
    expect(savedPreferences).toEqual(expect.objectContaining({
      enabled: true,
      email: 'nila@example.com',
      googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
    }));
    expect(savedPreferences.emailSmtp).toEqual(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: FIXED_TEST_SMTP_USER,
      passwordEncrypted: '',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          emailSmtp: expect.objectContaining({
            host: 'smtp.gmail.com',
            user: FIXED_TEST_SMTP_USER,
            passwordConfigured: SMTP_CONFIGURED,
          }),
        }),
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('updateNotificationPreferences rejects invalid payloads', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'user-5',
        email: '',
        role: 'analyst',
      }),
      updateById: jest.fn(),
    };
    const controller = createAuthController({ userModel });
    const req = {
      user: { id: 'user-5' },
      body: {
        notificationPreferences: {
          enabled: true,
          email: '',
          googleChatWebhookUrl: '',
        },
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.updateNotificationPreferences(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      message: 'Your registered account email is not valid for notifications.',
    }));
    expect(userModel.updateById).not.toHaveBeenCalled();
  });

  test('updateNotificationPreferences allows email-only settings when server SMTP is configured', async () => {
    const existingUser = {
      _id: 'user-6',
      email: 'ava@example.com',
      role: 'analyst',
      notificationPreferences: {
        enabled: false,
        email: '',
        googleChatWebhookUrl: '',
      },
    };
    const userModel = {
      findById: jest.fn().mockResolvedValue(existingUser),
      updateById: jest.fn().mockImplementation(async (id, update) => ({
        ...existingUser,
        _id: id,
        notificationPreferences: update.notificationPreferences,
      })),
    };
    const controller = createAuthController({ userModel });
    const req = {
      user: { id: 'user-6' },
      body: {
        notificationPreferences: {
          enabled: true,
          email: 'ava.alerts@example.com',
          googleChatWebhookUrl: '',
        },
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.updateNotificationPreferences(req, res, next);

    expect(userModel.updateById).toHaveBeenCalledWith('user-6', {
      notificationPreferences: expect.objectContaining({
        enabled: true,
        email: 'ava@example.com',
        googleChatWebhookUrl: '',
        emailSmtp: expect.objectContaining({
          host: 'smtp.gmail.com',
          user: FIXED_TEST_SMTP_USER,
        }),
      }),
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        notificationPreferences: expect.objectContaining({
          email: 'ava@example.com',
        }),
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('updateNotificationPreferences rejects email-only settings when SMTP is unreachable at runtime', async () => {
    EmailChannel.prototype.getCapability.mockResolvedValueOnce({
      available: false,
      message: 'Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.',
    });

    const existingUser = {
      _id: 'user-6b',
      email: 'ava@example.com',
      role: 'analyst',
      notificationPreferences: {
        enabled: false,
        email: '',
        googleChatWebhookUrl: '',
      },
    };
    const userModel = {
      findById: jest.fn().mockResolvedValue(existingUser),
      updateById: jest.fn(),
    };
    const controller = createAuthController({ userModel });
    const req = {
      user: { id: 'user-6b' },
      body: {
        notificationPreferences: {
          enabled: true,
          email: 'ava.alerts@example.com',
          googleChatWebhookUrl: '',
        },
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.updateNotificationPreferences(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      message: 'Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked. Add a Google Chat webhook to enable notifications without email delivery.',
    }));
    expect(userModel.updateById).not.toHaveBeenCalled();
  });

  test('sendTestEmail sends a message when server SMTP is configured', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'user-7',
        email: 'test@example.com',
        role: 'analyst',
      }),
    };
    const controller = createAuthController({ userModel });
    const req = { user: { id: 'user-7' } };
    const res = makeRes();
    const next = jest.fn();
    const sendSpy = jest.spyOn(EmailChannel.prototype, 'send').mockResolvedValue();

    await controller.sendTestEmail(req, res, next);

    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      notificationRecipientEmail: 'test@example.com',
      source: 'notification-settings',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Test email sent to test@example.com.',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('sendTestEmail reports runtime SMTP reachability failures clearly', async () => {
    EmailChannel.prototype.getCapability.mockResolvedValueOnce({
      available: false,
      message: 'Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.',
    });

    const userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'user-8',
        email: 'test@example.com',
        role: 'analyst',
      }),
    };
    const controller = createAuthController({ userModel });
    const req = { user: { id: 'user-8' } };
    const res = makeRes();
    const next = jest.fn();

    await controller.sendTestEmail(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      message: 'Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.',
    }));
    expect(res.json).not.toHaveBeenCalled();
  });
});
