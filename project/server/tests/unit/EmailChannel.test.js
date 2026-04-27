'use strict';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const axios = require('axios');
const nodemailer = require('nodemailer');
const config = require('../../src/config/env');
const EmailChannel = require('../../src/services/notification/channels/EmailChannel');

const FIXED_TEST_SMTP_USER = config.SMTP_USER || 'helloarav82@gmail.com';

describe('EmailChannel', () => {
  const baseConfig = {
    SMTP_PASS: 'app-password',
  };

  beforeEach(() => {
    axios.post.mockReset();
    nodemailer.createTransport.mockReset();
    EmailChannel._resetCapabilityCacheForTests();
  });

  test('is enabled when SMTP credentials are configured even without ALERT_EMAIL_TO', () => {
    const channel = new EmailChannel(baseConfig);

    expect(channel.isEnabled()).toBe(true);
  });

  test('sends to the incident recipient email when provided', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel({
      ...baseConfig,
      ALERT_EMAIL_TO: 'fallback@example.com',
    });

    await channel.send({
      id: 'INC-101',
      severity: 'HIGH',
      source: 'auth',
      message: 'Unauthorized login attempt',
      playbook: 'security-containment',
      notificationRecipientEmail: 'registered.user@gmail.com',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'registered.user@gmail.com',
        subject: '[HIGH] Incident INC-101',
      })
    );
  });

  test('falls back to ALERT_EMAIL_TO when the incident has no recipient', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-2' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel({
      ...baseConfig,
      ALERT_EMAIL_TO: 'fallback@example.com',
    });

    await channel.send({
      id: 'INC-102',
      severity: 'CRITICAL',
      source: 'kernel',
      message: 'Kernel panic detected',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fallback@example.com',
      })
    );
  });

  test('throws when no recipient is available', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-3' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel(baseConfig);

    await expect(channel.send({
      id: 'INC-103',
      severity: 'HIGH',
      source: 'auth',
      message: 'Failed authentication attempt',
    })).rejects.toThrow('Email recipient is required');

    expect(sendMail).not.toHaveBeenCalled();
  });

  test('uses fixed sender for user notification preferences', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-4' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel(baseConfig);
    const notificationPreferences = {
      enabled: true,
      email: 'owner@example.com',
      googleChatWebhookUrl: '',
      emailSmtp: {
        host: 'ignored.example',
        port: 2525,
        secure: true,
        user: 'ignored@example.com',
        passwordEncrypted: 'ignored-secret',
      },
    };

    expect(channel.isEnabled({
      notificationPreferences,
    })).toBe(true);

    await channel.send({
      id: 'INC-104',
      severity: 'LOW',
      source: 'stream',
      message: 'Suspicious session detected',
      notificationPreferences,
    });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: FIXED_TEST_SMTP_USER,
      to: 'owner@example.com',
      subject: '[LOW] Incident INC-104',
    }));
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      auth: {
        user: FIXED_TEST_SMTP_USER,
        pass: 'app-password',
      },
    }));
  });

  test('disables email delivery when saved preferences are turned off', () => {
    const channel = new EmailChannel(baseConfig);

    expect(channel.isEnabled({
      notificationPreferences: {
        enabled: false,
        email: 'owner@example.com',
        googleChatWebhookUrl: '',
      },
    })).toBe(false);
  });

  test('surfaces a clear message when SMTP connectivity is blocked', async () => {
    const sendMail = jest.fn().mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT 192.178.211.109:587',
    });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel(baseConfig);

    await expect(channel.send({
      id: 'INC-105',
      severity: 'LOW',
      source: 'manual-debug',
      message: 'Testing SMTP timeout mapping',
      notificationRecipientEmail: 'registered.user@gmail.com',
    })).rejects.toThrow('Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.');
  });

  test('maps IPv6 network reachability errors to the outbound SMTP blocked message', async () => {
    const sendMail = jest.fn().mockRejectedValue({
      code: 'ESOCKET',
      command: 'CONN',
      message: 'connect ENETUNREACH 2404:6800:4000:1025::6d:587',
    });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const channel = new EmailChannel(baseConfig);

    await expect(channel.send({
      id: 'INC-106',
      severity: 'LOW',
      source: 'manual-debug',
      message: 'Testing IPv6 SMTP failure mapping',
      notificationRecipientEmail: 'registered.user@gmail.com',
    })).rejects.toThrow('Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.');
  });

  test('getCapability reports email as available when SMTP verify succeeds', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const close = jest.fn();
    nodemailer.createTransport.mockReturnValue({ verify, close });

    const channel = new EmailChannel(baseConfig);
    const capability = await channel.getCapability({ forceRefresh: true, timeoutMs: 2000 });

    expect(capability).toEqual({
      available: true,
      message: `Email delivery uses fixed sender ${FIXED_TEST_SMTP_USER}.`,
    });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('getCapability reports email as unavailable when SMTP verify fails', async () => {
    const verify = jest.fn().mockRejectedValue({
      code: 'ESOCKET',
      command: 'CONN',
      message: 'connect ENETUNREACH 2404:6800:4000:1025::6d:587',
    });
    const close = jest.fn();
    nodemailer.createTransport.mockReturnValue({ verify, close });

    const channel = new EmailChannel(baseConfig);
    const capability = await channel.getCapability({ forceRefresh: true, timeoutMs: 2000 });

    expect(capability).toEqual({
      available: false,
      message: 'Cannot reach SMTP server smtp.gmail.com:587 from this machine. Outbound SMTP appears blocked.',
    });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('uses Resend when configured', async () => {
    axios.post.mockResolvedValue({ data: { id: 'email-1' } });

    const channel = new EmailChannel({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'Acme <alerts@example.com>',
    });

    await channel.send({
      id: 'INC-107',
      severity: 'HIGH',
      source: 'auth',
      message: 'Resend path test',
      notificationRecipientEmail: 'registered.user@gmail.com',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        from: 'Acme <alerts@example.com>',
        to: ['registered.user@gmail.com'],
        subject: '[HIGH] Incident INC-107',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      })
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('getCapability reports Resend as available when configured', async () => {
    const channel = new EmailChannel({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'Acme <alerts@example.com>',
    });

    const capability = await channel.getCapability({ forceRefresh: true });

    expect(capability).toEqual({
      available: true,
      message: 'Email delivery uses Resend API sender Acme <alerts@example.com>.',
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('surfaces a clear Resend authentication error', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 401,
        data: { message: 'Authentication required' },
      },
    });

    const channel = new EmailChannel({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_bad_key',
      RESEND_FROM_EMAIL: 'Acme <alerts@example.com>',
    });

    await expect(channel.send({
      id: 'INC-108',
      severity: 'LOW',
      source: 'manual-debug',
      message: 'Testing Resend auth mapping',
      notificationRecipientEmail: 'registered.user@gmail.com',
    })).rejects.toThrow('Resend API authentication failed. Check RESEND_API_KEY in server/.env.');
  });
});
