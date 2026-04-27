/**
 * ============================================================================
 * EMAIL CHANNEL — Sends incident alerts via SMTP
 * ============================================================================
 */

const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns');
const nodemailer = require('nodemailer');

// Fix ENETUNREACH on IPv6-only environments where SMTP is forced to IPv4
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_USER = 'helloarav82@gmail.com';
const DEFAULT_EMAIL_PROVIDER = 'auto';
const DEFAULT_RESEND_API_BASE_URL = 'https://api.resend.com';
const DEFAULT_VERIFY_TIMEOUT_MS = 4000;
const DEFAULT_CAPABILITY_TTL_MS = 5 * 60 * 1000;
const capabilityCache = new Map();

class EmailChannel {
  /**
   * @param {Object} config - App config
   */
  constructor(config) {
    this.name = 'email';
    this.config = config || {};
    this.smtpHost = this.config.SMTP_HOST || DEFAULT_SMTP_HOST;
    this.smtpPort = parseInt(this.config.SMTP_PORT, 10) || DEFAULT_SMTP_PORT;
    this.smtpUser = this.config.SMTP_USER || DEFAULT_SMTP_USER;
    this.smtpSecure = this.smtpPort === 465;
    this.smtpPass = this.config.SMTP_PASS || '';
    this.emailProvider = String(this.config.EMAIL_PROVIDER || DEFAULT_EMAIL_PROVIDER).trim().toLowerCase();
    this.resendApiKey = String(this.config.RESEND_API_KEY || '').trim();
    this.resendFromEmail = String(this.config.RESEND_FROM_EMAIL || '').trim();
    this.resendApiBaseUrl = String(this.config.RESEND_API_BASE_URL || DEFAULT_RESEND_API_BASE_URL).trim() || DEFAULT_RESEND_API_BASE_URL;
    this.alertTo = this.config.ALERT_EMAIL_TO || '';

    this._transporter = null;
  }

  isEnabled(incident) {
    if (!this.hasDeliveryConfig()) {
      return false;
    }

    if (!incident) {
      return true;
    }

    return Boolean(this._resolveRecipient(incident));
  }

  shouldTrigger(severity, incident) {
    if (this._usesUserPreferences(incident)) {
      return this.isEnabled(incident);
    }

    return severity === 'CRITICAL' || severity === 'HIGH';
  }

  async send(incident) {
    const recipient = this._resolveRecipient(incident);
    if (!recipient) {
      throw new Error('Email recipient is required');
    }

    const provider = this._resolveActiveProvider();
    if (!provider) {
      throw new Error('Email delivery is unavailable until SMTP or Resend is configured in server/.env.');
    }

    const message = {
      subject: `[${incident.severity || 'UNKNOWN'}] Incident ${incident.id || ''}`,
      text: [
        `Incident ID: ${incident.id || 'N/A'}`,
        `Severity: ${incident.severity || 'UNKNOWN'}`,
        `Source: ${incident.source || 'unknown'}`,
        `Message: ${incident.message || ''}`,
        `Playbook: ${incident.playbook || 'manual-triage'}`,
      ].join('\n'),
    };

    if (provider === 'resend') {
      await this._sendViaResend({ recipient, message });
      return;
    }

    const transportConfig = this._resolveTransportConfig(incident);
    if (!transportConfig) {
      throw new Error('Email SMTP settings are required');
    }

    const transporter = this._getTransporter(transportConfig);

    try {
      await transporter.sendMail({
        from: transportConfig.user,
        to: recipient,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      throw this._formatTransportError(error);
    }
  }

  _resolveRecipient(incident = {}) {
    if (this._usesUserPreferences(incident)) {
      return this._resolveUserPreferenceRecipient(incident);
    }

    return String(
      incident.notificationRecipientEmail ||
      incident.recipientEmail ||
      incident.userEmail ||
      this.alertTo ||
      ''
    ).trim();
  }

  _resolveTransportConfig(incident = {}) {
    if (!this._hasSmtpConfig()) {
      return null;
    }

    return {
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      user: this.smtpUser,
      pass: this.smtpPass,
    };
  }

  _resolveUserPreferenceRecipient(incident = {}) {
    const prefs = incident.notificationPreferences || {};
    if (!prefs.enabled) {
      return '';
    }

    return String(
      prefs.email ||
      incident.notificationRecipientEmail ||
      incident.recipientEmail ||
      incident.userEmail ||
      ''
    ).trim().toLowerCase();
  }

  _usesUserPreferences(incident = {}) {
    return Boolean(
      incident &&
      incident.notificationPreferences &&
      typeof incident.notificationPreferences === 'object'
    );
  }

  hasDeliveryConfig() {
    return Boolean(this._resolveActiveProvider());
  }

  _hasSmtpConfig() {
    return Boolean(this.smtpHost && this.smtpUser && this.smtpPass);
  }

  _hasResendConfig() {
    return Boolean(this.resendApiKey && this.resendFromEmail);
  }

  _resolveActiveProvider() {
    if (this.emailProvider === 'resend') {
      return this._hasResendConfig() ? 'resend' : '';
    }

    if (this.emailProvider === 'smtp') {
      return this._hasSmtpConfig() ? 'smtp' : '';
    }

    if (this._hasResendConfig()) {
      return 'resend';
    }

    if (this._hasSmtpConfig()) {
      return 'smtp';
    }

    return '';
  }

  _getTransporter(transportConfig) {
    const cacheKey = this._buildTransportCacheKey(transportConfig);

    if (!this._transporter || this._transporterCacheKey !== cacheKey) {
      this._transporter = nodemailer.createTransport({
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        connectionTimeout: 15000,
        socketTimeout: 15000,
        auth: {
          user: transportConfig.user,
          pass: transportConfig.pass,
        },
      });
      this._transporterCacheKey = cacheKey;
    }

    return this._transporter;
  }

  async getCapability(options = {}) {
    const provider = this._resolveActiveProvider();
    if (!provider) {
      return {
        available: false,
        message: 'Email delivery is unavailable until SMTP or Resend is configured in server/.env.',
      };
    }

    if (provider === 'resend') {
      return {
        available: true,
        message: `Email delivery uses Resend API sender ${this.resendFromEmail}.`,
      };
    }

    const { forceRefresh = false } = options;
    const ttlMs = Math.max(1000, Number(options.ttlMs) || DEFAULT_CAPABILITY_TTL_MS);
    const transportConfig = this._resolveTransportConfig();
    const cacheKey = this._buildTransportCacheKey(transportConfig);
    const now = Date.now();
    const cached = capabilityCache.get(cacheKey);

    if (!forceRefresh && cached) {
      if (cached.promise) {
        return cached.promise;
      }

      if (cached.expiresAt > now && cached.value) {
        return cached.value;
      }
    }

    const probePromise = this._probeTransport(options)
      .then(() => ({
        available: true,
        message: `Email delivery uses fixed sender ${this.smtpUser}.`,
      }))
      .catch((error) => ({
        available: false,
        message: this._formatTransportError(error).message,
      }));

    capabilityCache.set(cacheKey, { promise: probePromise, expiresAt: now + ttlMs });

    const value = await probePromise;
    capabilityCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async _sendViaResend({ recipient, message }) {
    try {
      await axios.post(
        `${this.resendApiBaseUrl.replace(/\/+$/, '')}/emails`,
        {
          from: this.resendFromEmail,
          to: [recipient],
          subject: message.subject,
          text: message.text,
        },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      throw this._formatResendError(error);
    }
  }

  _buildTransportCacheKey(transportConfig) {
    return [
      transportConfig.host,
      transportConfig.port,
      transportConfig.secure,
      transportConfig.user,
      crypto.createHash('sha256').update(String(transportConfig.pass || '')).digest('hex'),
    ].join('|');
  }

  async _probeTransport(options = {}) {
    const transportConfig = this._resolveTransportConfig();
    if (!transportConfig) {
      throw new Error('Email SMTP settings are required');
    }

    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_VERIFY_TIMEOUT_MS);
    const transporter = nodemailer.createTransport({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      auth: {
        user: transportConfig.user,
        pass: transportConfig.pass,
      },
    });

    try {
      await transporter.verify();
    } finally {
      if (typeof transporter.close === 'function') {
        transporter.close();
      }
    }
  }

  _formatResendError(error) {
    const code = String(error?.code || '').toUpperCase();
    const errno = String(error?.errno || '').toUpperCase();
    const message = String(
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      ''
    ).trim();
    const status = Number(error?.response?.status || 0);
    const connectivityCodes = new Set([
      'ETIMEDOUT',
      'ECONNABORTED',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
    ]);

    if (
      connectivityCodes.has(code) ||
      connectivityCodes.has(errno) ||
      /timed out|network error|enotfound|enetunreach|ehostunreach|econnrefused|eai_again/i.test(message)
    ) {
      return new Error(
        `Cannot reach Resend API at ${this.resendApiBaseUrl}. Check outbound HTTPS access from this machine.`
      );
    }

    if (status === 401 || status === 403) {
      return new Error('Resend API authentication failed. Check RESEND_API_KEY in server/.env.');
    }

    if (status === 422) {
      return new Error(
        message || 'Resend rejected the email. Check RESEND_FROM_EMAIL and verify the sender domain in Resend.'
      );
    }

    if (status >= 500) {
      return new Error('Resend API is temporarily unavailable. Please try again.');
    }

    return new Error(message || 'Email delivery failed');
  }

  _formatTransportError(error) {
    const code = String(error?.code || '').toUpperCase();
    const errno = String(error?.errno || '').toUpperCase();
    const command = String(error?.command || '').toUpperCase();
    const message = String(error?.message || '').trim();
    const connectivityCodes = new Set([
      'ETIMEDOUT',
      'ECONNECTION',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'EACCES',
      'ECONNREFUSED',
      'EAI_AGAIN',
    ]);
    const looksLikeConnectivityFailure =
      connectivityCodes.has(code) ||
      connectivityCodes.has(errno) ||
      (code === 'ESOCKET' && command === 'CONN') ||
      /timed out|connection timeout|network is unreachable|enetunreach|ehostunreach|econnrefused|eai_again/i.test(message);

    if (looksLikeConnectivityFailure) {
      return new Error(
        `Cannot reach SMTP server ${this.smtpHost}:${this.smtpPort} from this machine. Outbound SMTP appears blocked.`
      );
    }

    if (code === 'EAUTH' || /invalid login|authentication/i.test(message)) {
      return new Error(
        `SMTP authentication failed for ${this.smtpUser}. Check SMTP_USER and SMTP_PASS in server/.env.`
      );
    }

    return new Error(message || 'Email delivery failed');
  }

  static _resetCapabilityCacheForTests() {
    capabilityCache.clear();
  }
}

module.exports = EmailChannel;
