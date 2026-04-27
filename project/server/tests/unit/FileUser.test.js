'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const FileUserModel = require('../../src/models/FileUser');

describe('FileUserModel', () => {
  let tempDir;
  let userModel;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-analyzer-file-user-'));
    userModel = new FileUserModel(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('create stores normalized email and default viewer role', async () => {
    const created = await userModel.create({
      name: 'Ravi',
      email: 'RAVI@EXAMPLE.COM',
      provider: 'local',
    });

    expect(created.email).toBe('ravi@example.com');
    expect(created.role).toBe('viewer');
    expect(created.notificationPreferences).toEqual({
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
  });

  test('findByEmail, updateById, and linkGoogleAccount work end-to-end', async () => {
    const created = await userModel.create({
      name: 'Mina',
      email: 'mina@example.com',
      provider: 'local',
      role: 'analyst',
    });

    const found = await userModel.findByEmail('MINA@example.com');
    expect(found._id).toBe(created._id);

    const updated = await userModel.updateById(created._id, { role: 'admin' });
    expect(updated.role).toBe('admin');

    const withNotifications = await userModel.updateById(created._id, {
      notificationPreferences: {
        enabled: true,
        email: 'Mina.Alerts@Example.com',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      },
    });
    expect(withNotifications.notificationPreferences).toEqual({
      enabled: true,
      email: 'mina.alerts@example.com',
      googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test',
      emailSmtp: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        passwordEncrypted: '',
      },
    });

    const linked = await userModel.linkGoogleAccount(created._id, 'google-123', 'https://avatar.example');
    expect(linked.googleId).toBe('google-123');
    expect(linked.provider).toBe('google');
  });
});
