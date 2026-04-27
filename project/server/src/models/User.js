/**
 * ============================================================================
 * USER MODEL — MongoDB User Document
 * ============================================================================
 * Manages user documents in the 'users' collection with support for:
 *   - Email/password authentication (bcrypt hashed)
 *   - Google OAuth sign-in (stores googleId)
 *   - Role-based access (admin, analyst, viewer)
 *
 * SCHEMA:
 *   {
 *     _id:        ObjectId (auto),
 *     name:       string,
 *     email:      string (unique, indexed),
 *     password:   string (bcrypt hash, null for Google-only users),
 *     googleId:   string (null for email-only users),
 *     avatar:     string (profile picture URL),
 *     role:       string (admin | analyst | viewer),
 *     provider:   string (local | google),
 *     createdAt:  Date,
 *     updatedAt:  Date,
 *   }
 * ============================================================================
 */

const COLLECTION = 'users';
const { ObjectId } = require('mongodb');
const { ensureNotificationPreferences } = require('../utils/notificationPreferences');

class UserModel {
  /**
   * @param {import('../db/MongoDatabase')} db
   */
  constructor(db) {
    this.db = db;
    this._ensureIndexes();
  }

  /** Create a unique index on email (run once) */
  async _ensureIndexes() {
    try {
      const col = this.db.getCollection(COLLECTION);
      await col.createIndex({ email: 1 }, { unique: true });
      await col.createIndex({ googleId: 1 }, { sparse: true });
    } catch (_) {
      // Indexes may already exist — safe to ignore
    }
  }

  /**
   * Find a user by email address.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    return this.db.getCollection(COLLECTION).findOne({ email: email.toLowerCase() });
  }

  /**
   * Find a user by their Google ID.
   * @param {string} googleId
   * @returns {Promise<Object|null>}
   */
  async findByGoogleId(googleId) {
    return this.db.getCollection(COLLECTION).findOne({ googleId });
  }

  /**
   * Find a user by their MongoDB _id.
   * @param {string|import('mongodb').ObjectId} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.db.getCollection(COLLECTION).findOne({ _id: new ObjectId(id) });
  }

  /**
   * Create a new user document.
   * @param {Object} userData
   * @returns {Promise<Object>} The inserted document
   */
  async create(userData) {
    const now = new Date();
    const doc = {
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: userData.password || null,
      googleId: userData.googleId || null,
      avatar: userData.avatar || null,
      role: userData.role || 'viewer',
      provider: userData.provider || 'local',
      notificationPreferences: ensureNotificationPreferences(userData.notificationPreferences),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db.getCollection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  /**
   * Update a user by ID.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object|null>} Updated document
   */
  async updateById(id, updates) {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const nextUpdates = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates || {}, 'notificationPreferences')
        ? { notificationPreferences: ensureNotificationPreferences(updates.notificationPreferences) }
        : {}),
    };

    const result = await this.db.getCollection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...nextUpdates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  }

  /**
   * Link a Google account to an existing user.
   * @param {string} id
   * @param {string} googleId
   * @param {string} avatar
   */
  async linkGoogleAccount(id, googleId, avatar) {
    return this.updateById(id, { googleId, avatar, provider: 'google' });
  }
}

module.exports = UserModel;
