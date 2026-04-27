/**
 * ============================================================================
 * AUTH CONTROLLER — Registration, Login & Google OAuth
 * ============================================================================
 * Handles all authentication flows:
 *   POST /api/auth/register   — Email/password registration
 *   POST /api/auth/login      — Email/password login
 *   POST /api/auth/google     — Google ID-token verification + upsert
 *   GET  /api/auth/me         — Get current authenticated user profile
 *
 * Passwords are hashed with bcrypt (12 rounds).
 * JWTs are signed with HS256 and include { sub, email, role }.
 * Google tokens are verified using Google's OAuth2Client.
 * ============================================================================
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { ensureNotificationPreferences, normalizeNotificationPreferences } = require('../utils/notificationPreferences');
const { isValidEmail, normalizeEmail } = require('../utils/email');
const EmailChannel = require('../services/notification/channels/EmailChannel');

const BCRYPT_ROUNDS = 12;
const FIXED_SMTP_HOST = config.SMTP_HOST || 'smtp.gmail.com';
const FIXED_SMTP_PORT = Number(config.SMTP_PORT) || 587;
const FIXED_SMTP_SECURE = FIXED_SMTP_PORT === 465;
const FIXED_SMTP_USER = config.SMTP_USER || 'helloarav82@gmail.com';

let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch (_) {
  // Optional dependency: auth still works using scrypt fallback below.
}

function hashWithScrypt(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function compareWithScrypt(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const [, salt, originalHex] = storedHash.split('$');
  if (!salt || !originalHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 64).toString('hex');
  const original = Buffer.from(originalHex, 'hex');
  const derived = Buffer.from(derivedHex, 'hex');
  if (original.length !== derived.length) return false;
  return crypto.timingSafeEqual(original, derived);
}

async function hashPassword(password) {
  if (bcrypt) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  return hashWithScrypt(password);
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    return compareWithScrypt(password, storedHash);
  }
  if (!bcrypt) {
    return false;
  }
  return bcrypt.compare(password, storedHash);
}

/**
 * Creates the auth controller with injected dependencies.
 * @param {{ userModel: import('../models/User') }} deps
 */
function createAuthController({ userModel }) {
  const notificationCapabilities = {
    googleChatWebhook: {
      available: true,
      message: 'Google Chat webhook delivery is available when you save a webhook URL.',
    },
  };

  // ---- Lazy-load Google OAuth client (only when needed) ----
  let _googleClient = null;
  function getGoogleClient() {
    if (!_googleClient) {
      try {
        const { OAuth2Client } = require('google-auth-library');
        _googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
      } catch (err) {
        console.warn('[auth] google-auth-library not installed — Google sign-in disabled');
      }
    }
    return _googleClient;
  }

  /**
   * Signs a JWT for the given user.
   * @param {Object} user - User document from DB
   * @returns {string} Signed JWT
   */
  function signToken(user) {
    return jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );
  }

  function defaultEmailCapability() {
    const emailConfigured = isServerEmailConfigured();
    return {
      available: emailConfigured,
      message: emailConfigured
        ? `Email delivery uses fixed sender ${FIXED_SMTP_USER}.`
        : 'Email delivery is unavailable until SMTP or Resend is configured in server/.env.',
    };
  }

  async function resolveEmailCapability(options = {}) {
    const emailChannel = new EmailChannel(config);
    return emailChannel.getCapability(options);
  }

  /**
   * Strips sensitive fields before sending user data to the client.
   */
  function sanitizeUser(user, options = {}) {
    const { password, ...safe } = user;
    const registeredEmail = normalizeEmail(safe.email);
    const preferences = ensureNotificationPreferences(safe.notificationPreferences);
    const sanitizedPreferences = sanitizeNotificationPreferences(preferences);
    const emailCapability = options.emailCapability || defaultEmailCapability();

    return {
      id: user._id.toString(),
      name: safe.name,
      email: safe.email,
      avatar: safe.avatar,
      role: safe.role,
      provider: safe.provider,
      createdAt: safe.createdAt,
      notificationPreferences: sanitizedPreferences,
      notificationCapabilities: {
        ...notificationCapabilities,
        email: emailCapability,
        registeredEmail: {
          available: isValidEmail(registeredEmail),
          message: isValidEmail(registeredEmail)
            ? 'Registered email is valid for notifications.'
            : 'Your registered account email is not a valid email address.',
        },
      },
    };
  }

  async function sanitizeUserWithRuntimeCapabilities(user, options = {}) {
    const emailCapability = await resolveEmailCapability(options);
    return sanitizeUser(user, { emailCapability });
  }

  function sanitizeNotificationPreferences(preferences) {
    const prefs = ensureNotificationPreferences(preferences);
    return {
      enabled: prefs.enabled,
      email: prefs.email,
      googleChatWebhookUrl: prefs.googleChatWebhookUrl,
      emailSmtp: {
        host: FIXED_SMTP_HOST,
        port: FIXED_SMTP_PORT,
        secure: FIXED_SMTP_SECURE,
        user: FIXED_SMTP_USER,
        passwordConfigured: isServerSmtpConfigured(),
        provider: config.EMAIL_PROVIDER || 'auto',
      },
    };
  }

  function isServerSmtpConfigured() {
    return Boolean(config.SMTP_PASS && FIXED_SMTP_HOST && FIXED_SMTP_USER);
  }

  function isServerEmailConfigured() {
    return new EmailChannel(config).hasDeliveryConfig();
  }

  async function validateNotificationPreferences(input, user = {}, options = {}) {
    const prefs = normalizeNotificationPreferences(input);
    const registeredEmail = normalizeEmail(user.email);

    if (registeredEmail && !isValidEmail(registeredEmail)) {
      throw new ValidationError('Your registered account email is not valid for notifications.');
    }

    if (prefs.googleChatWebhookUrl) {
      let parsedUrl;
      try {
        parsedUrl = new URL(prefs.googleChatWebhookUrl);
      } catch (_) {
        throw new ValidationError('Enter a valid Google Chat webhook URL.');
      }

      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.hostname !== 'chat.googleapis.com' ||
        !parsedUrl.pathname.startsWith('/v1/spaces/')
      ) {
        throw new ValidationError('Enter a valid Google Chat webhook URL.');
      }
    }

    // Only require server email delivery when enabling without a Google Chat webhook
    if (prefs.enabled && !prefs.googleChatWebhookUrl) {
      if (!isServerEmailConfigured()) {
        throw new ValidationError('Email delivery is unavailable until SMTP or Resend is configured in server/.env. Add a Google Chat webhook to enable notifications without email delivery.');
      }

      const emailCapability = options.emailCapability || await resolveEmailCapability({ forceRefresh: true });
      if (!emailCapability.available) {
        throw new ValidationError(
          `${emailCapability.message} Add a Google Chat webhook to enable notifications without email delivery.`
        );
      }

      if (!registeredEmail || !isValidEmail(registeredEmail)) {
        throw new ValidationError('Your registered account email is not valid for notifications.');
      }
    }

    return {
      ...ensureNotificationPreferences(user.notificationPreferences),
      enabled: prefs.enabled,
      email: prefs.enabled ? registeredEmail : '',
      googleChatWebhookUrl: prefs.googleChatWebhookUrl,
      emailSmtp: {
        host: FIXED_SMTP_HOST,
        port: FIXED_SMTP_PORT,
        secure: FIXED_SMTP_SECURE,
        user: FIXED_SMTP_USER,
        passwordEncrypted: '',
      },
    };
  }

  // ===========================
  //  POST /api/auth/register
  // ===========================
  async function register(req, res, next) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw new ValidationError('Name, email, and password are required.');
      }
      if (!isValidEmail(email)) {
        throw new ValidationError('Enter a valid email address.');
      }
      if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters.');
      }

      // Check for existing user
      const existing = await userModel.findByEmail(email);
      if (existing) {
        throw new ValidationError('An account with this email already exists.');
      }

      // Hash password + create user
      const hashedPassword = await hashPassword(password);
      const user = await userModel.create({
        name,
        email,
        password: hashedPassword,
        provider: 'local',
        role: 'analyst',
      });

      const token = signToken(user);

      res.status(201).json({
        success: true,
        token,
        user: sanitizeUser(user),
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  POST /api/auth/login
  // ===========================
  async function login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required.');
      }

      const user = await userModel.findByEmail(email);
      if (!user) {
        throw new AuthenticationError();
      }

      // If user signed up via Google only (no password set)
      if (!user.password) {
        throw new ValidationError('This account uses Google sign-in. Please sign in with Google.');
      }

      const isMatch = await verifyPassword(password, user.password);
      if (!isMatch) {
        throw new AuthenticationError();
      }

      // Backward-compat: older users may have been created as viewer,
      // which blocks core analyze/upload routes in this app.
      if (user.role === 'viewer' && typeof userModel.updateById === 'function') {
        const upgraded = await userModel.updateById(user._id.toString(), { role: 'analyst' });
        if (upgraded) {
          user.role = upgraded.role;
        }
      }

      const token = signToken(user);

      res.json({
        success: true,
        token,
        user: sanitizeUser(user),
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  POST /api/auth/google
  // ===========================
  async function googleAuth(req, res, next) {
    try {
      const { credential } = req.body;

      if (!credential) {
        throw new ValidationError('Google credential token is required.');
      }

      const client = getGoogleClient();
      if (!client) {
        throw new ValidationError('Google sign-in is not configured on this server.');
      }

      // Verify the ID token with Google
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // Check if user exists by Google ID or email
      let user = await userModel.findByGoogleId(googleId);

      if (!user) {
        // Check if there's an existing account with this email
        user = await userModel.findByEmail(email);

        if (user) {
          // Link Google account to existing email user
          user = await userModel.linkGoogleAccount(user._id.toString(), googleId, picture);
        } else {
          // Create a new user from Google profile
          user = await userModel.create({
            name,
            email,
            googleId,
            avatar: picture,
            provider: 'google',
            role: 'analyst',
          });
        }
      }

      const token = signToken(user);

      res.json({
        success: true,
        token,
        user: sanitizeUser(user),
      });
    } catch (err) {
      if (err.message && err.message.includes('Token used too late')) {
        return next(new ValidationError('Google token has expired. Please try again.'));
      }
      next(err);
    }
  }

  // ===========================
  //  GET /api/auth/me
  // ===========================
  async function getProfile(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);

      if (!user) {
        throw new AuthenticationError();
      }

      res.json({
        success: true,
        user: await sanitizeUserWithRuntimeCapabilities(user),
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  PUT /api/auth/notifications
  // ===========================
  async function updateNotificationPreferences(req, res, next) {
    try {
      const existingUser = await userModel.findById(req.user.id);

      if (!existingUser) {
        throw new AuthenticationError();
      }

      const emailCapability = await resolveEmailCapability({ forceRefresh: true });
      const nextPreferences = await validateNotificationPreferences(
        req.body?.notificationPreferences ?? req.body,
        existingUser,
        { emailCapability }
      );

      const updatedUser = await userModel.updateById(req.user.id, {
        notificationPreferences: nextPreferences,
      });

      res.json({
        success: true,
        user: await sanitizeUserWithRuntimeCapabilities(updatedUser || {
          ...existingUser,
          notificationPreferences: nextPreferences,
        }, { forceRefresh: true }),
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  POST /api/auth/notifications/test-email
  // ===========================
  async function sendTestEmail(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);
      if (!user) throw new AuthenticationError();

      const registeredEmail = normalizeEmail(user.email);
      const simulatedIncident = {
        id: `TEST-${Date.now()}`,
        severity: 'LOW',
        source: 'notification-settings',
        message: 'This is a test alert from Log Analyzer.',
        playbook: 'test',
        notificationRecipientEmail: registeredEmail,
        notificationPreferences: {
          ...user.notificationPreferences,
          enabled: true // Force enabled for testing
        }
      };

      const emailChannel = new EmailChannel(config);
      const emailCapability = await emailChannel.getCapability({ forceRefresh: true });

      if (!emailChannel.isEnabled(simulatedIncident)) {
        if (!emailCapability.available) {
          throw new ValidationError(emailCapability.message);
        }

        throw new ValidationError('A valid registered email address is required to send a test email.');
      }

      if (!emailCapability.available) {
        throw new ValidationError(emailCapability.message);
      }

      await emailChannel.send(simulatedIncident);

      res.json({
        success: true,
        message: `Test email sent to ${registeredEmail}.`,
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  GET /api/auth/user-data
  // ===========================
  async function getUserData(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);

      if (!user) {
        throw new AuthenticationError();
      }

      // Gather collection counts for this user
      const db = userModel.db;
      const ownerId = req.user.id;
      let stats = { incidents: 0, logEntries: 0, reports: 0, sourceDocuments: 0 };

      try {
        const incidents = db.getCollection('incidents');
        const logEntries = db.getCollection('log_entries');
        const reports = db.getCollection('reports');
        const sourceDocs = db.getCollection('source_documents');

        const [incidentCount, logEntryCount, reportCount, sourceDocCount] = await Promise.all([
          incidents.countDocuments({ ownerId }),
          logEntries.countDocuments({ ownerId }),
          reports.countDocuments({ ownerId }),
          sourceDocs.countDocuments({ ownerId }),
        ]);

        stats = {
          incidents: incidentCount,
          logEntries: logEntryCount,
          reports: reportCount,
          sourceDocuments: sourceDocCount,
        };
      } catch (_) {
        // Collections may not exist yet — that's fine
      }

      const { password, ...safeUser } = user;

      res.json({
        success: true,
        userData: {
          id: user._id.toString(),
          name: safeUser.name,
          email: safeUser.email,
          avatar: safeUser.avatar || null,
          role: safeUser.role,
          provider: safeUser.provider,
          googleId: safeUser.googleId || null,
          notificationPreferences: ensureNotificationPreferences(safeUser.notificationPreferences),
          createdAt: safeUser.createdAt,
          updatedAt: safeUser.updatedAt,
        },
        stats,
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  GET /api/auth/user-data/:collection
  // ===========================
  async function getUserCollectionData(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);
      if (!user) {
        throw new AuthenticationError();
      }

      const collectionMap = {
        incidents: 'incidents',
        log_entries: 'log_entries',
        reports: 'reports',
        source_documents: 'source_documents',
      };

      const collectionKey = req.params.collection;
      const collectionName = collectionMap[collectionKey];

      if (!collectionName) {
        throw new ValidationError('Invalid collection name. Use: incidents, log_entries, reports, source_documents');
      }

      const db = userModel.db;
      const ownerId = req.user.id;

      const col = db.getCollection(collectionName);
      const documents = await col
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      // Remove sensitive/internal fields
      const cleanDocs = documents.map((doc) => {
        const { ownerId: _oid, ...rest } = doc;
        return { ...rest, _id: doc._id.toString(), reportId: doc.reportId?.toString() || null };
      });

      res.json({
        success: true,
        collection: collectionKey,
        count: cleanDocs.length,
        documents: cleanDocs,
      });
    } catch (err) {
      next(err);
    }
  }

  // ===========================
  //  PUT /api/auth/update-profile
  // ===========================
  async function updateProfile(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);
      if (!user) {
        throw new AuthenticationError();
      }

      const { name, currentPassword, newPassword } = req.body;
      const updates = {};

      // Update name if provided
      if (name && name.trim()) {
        updates.name = name.trim();
      }

      // Update password if provided
      if (newPassword) {
        if (!currentPassword) {
          throw new ValidationError('Current password is required to set a new password.');
        }
        if (newPassword.length < 6) {
          throw new ValidationError('New password must be at least 6 characters.');
        }
        // Google-only users don't have a password
        if (!user.password) {
          throw new ValidationError('Cannot change password for Google-only accounts.');
        }
        const isMatch = await verifyPassword(currentPassword, user.password);
        if (!isMatch) {
          throw new ValidationError('Current password is incorrect.');
        }
        updates.password = await hashPassword(newPassword);
      }

      if (Object.keys(updates).length === 0) {
        throw new ValidationError('No changes provided.');
      }

      const updatedUser = await userModel.updateById(req.user.id, updates);

      res.json({
        success: true,
        message: 'Profile updated successfully.',
        user: await sanitizeUserWithRuntimeCapabilities(updatedUser || { ...user, ...updates }),
      });
    } catch (err) {
      next(err);
    }
  }

  return {
    register,
    login,
    googleAuth,
    getProfile,
    updateNotificationPreferences,
    sendTestEmail,
    getUserData,
    getUserCollectionData,
    updateProfile,
  };
}

module.exports = createAuthController;
