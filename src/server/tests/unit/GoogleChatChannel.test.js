'use strict';

jest.mock('axios');

const axios = require('axios');
const jwt = require('jsonwebtoken');
const GoogleChatChannel = require('../../src/services/notification/channels/GoogleChatChannel');

describe('GoogleChatChannel', () => {
  const INCIDENT = {
    id: 'INC-100',
    severity: 'LOW',
    type: 'keyword-trigger',
    source: 'auth',
    message: 'Unauthorized login attempt',
    playbook: 'security-containment',
    notificationRecipientEmail: 'analyst@example.com',
  };

  beforeEach(() => {
    axios.post.mockReset();
    axios.get.mockReset();
  });

  test('is enabled when webhook mode is configured', () => {
    const channel = new GoogleChatChannel({
      GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/webhook/demo',
    });

    expect(channel.isEnabled()).toBe(true);
  });

  test('uses webhook mode when webhook URL is present', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });

    const channel = new GoogleChatChannel({
      GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/webhook/demo',
    });

    await channel.send(INCIDENT);

    expect(axios.post).toHaveBeenCalledWith(
      'https://chat.googleapis.com/webhook/demo',
      expect.objectContaining({
        text: expect.stringContaining('Incident detected: LOW'),
      })
    );
  });

  test('uses the saved user webhook when notification preferences are enabled', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });

    const channel = new GoogleChatChannel({});

    expect(channel.isEnabled({
      notificationPreferences: {
        enabled: true,
        email: '',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      },
    })).toBe(true);

    await channel.send({
      ...INCIDENT,
      notificationPreferences: {
        enabled: true,
        email: '',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      },
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      expect.objectContaining({
        text: expect.stringContaining('Unauthorized login attempt'),
      })
    );
  });

  test('posts to a direct-message space for the registered email when API mode is configured', async () => {
    const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('signed-jwt');
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'token-123', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: { name: 'spaces/AAA/messages/BBB' } });
    axios.get.mockResolvedValue({ data: { name: 'spaces/AAA' } });

    const channel = new GoogleChatChannel({
      GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL: 'bot@example.iam.gserviceaccount.com',
      GOOGLE_CHAT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    });

    await channel.send(INCIDENT);

    expect(signSpy).toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces:findDirectMessage',
      expect.objectContaining({
        params: { name: 'users/analyst@example.com' },
      })
    );
    expect(axios.post).toHaveBeenLastCalledWith(
      'https://chat.googleapis.com/v1/spaces/AAA/messages',
      expect.objectContaining({
        text: expect.stringContaining('Unauthorized login attempt'),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );

    signSpy.mockRestore();
  });

  test('throws when API mode is used without a recipient email', async () => {
    const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue('signed-jwt');

    const channel = new GoogleChatChannel({
      GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL: 'bot@example.iam.gserviceaccount.com',
      GOOGLE_CHAT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    });

    await expect(channel.send({ ...INCIDENT, notificationRecipientEmail: '' }))
      .rejects
      .toThrow('Google Chat recipient email is required');

    signSpy.mockRestore();
  });

  test('respects the configured minimum severity', () => {
    const channel = new GoogleChatChannel({
      GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/webhook/demo',
      GOOGLE_CHAT_MIN_SEVERITY: 'HIGH',
    });

    expect(channel.shouldTrigger('LOW')).toBe(false);
    expect(channel.shouldTrigger('CRITICAL')).toBe(true);
  });
});
