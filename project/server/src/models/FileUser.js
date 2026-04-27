const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { ensureNotificationPreferences } = require('../utils/notificationPreferences');

class FileUserModel {
  constructor(outputDir) {
    this.outputDir = outputDir || path.resolve(process.cwd(), 'output');
    this.filePath = path.join(this.outputDir, 'users.json');
    fs.mkdirSync(this.outputDir, { recursive: true });
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  _readUsers() {
    this._ensureFile();
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
  }

  _writeUsers(users) {
    fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2));
  }

  async findByEmail(email) {
    const users = this._readUsers();
    return users.find((u) => u.email === String(email).toLowerCase()) || null;
  }

  async findByGoogleId(googleId) {
    const users = this._readUsers();
    return users.find((u) => u.googleId === googleId) || null;
  }

  async findById(id) {
    const users = this._readUsers();
    return users.find((u) => String(u._id) === String(id)) || null;
  }

  async create(userData) {
    const users = this._readUsers();
    const now = new Date().toISOString();
    const doc = {
      _id: randomUUID(),
      name: userData.name,
      email: String(userData.email).toLowerCase(),
      password: userData.password || null,
      googleId: userData.googleId || null,
      avatar: userData.avatar || null,
      role: userData.role || 'viewer',
      provider: userData.provider || 'local',
      notificationPreferences: ensureNotificationPreferences(userData.notificationPreferences),
      createdAt: now,
      updatedAt: now,
    };
    users.push(doc);
    this._writeUsers(users);
    return doc;
  }

  async updateById(id, updates) {
    const users = this._readUsers();
    const idx = users.findIndex((u) => String(u._id) === String(id));
    if (idx === -1) return null;
    const updated = {
      ...users[idx],
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates || {}, 'notificationPreferences')
        ? { notificationPreferences: ensureNotificationPreferences(updates.notificationPreferences) }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    users[idx] = updated;
    this._writeUsers(users);
    return updated;
  }

  async linkGoogleAccount(id, googleId, avatar) {
    return this.updateById(id, { googleId, avatar, provider: 'google' });
  }
}

module.exports = FileUserModel;
