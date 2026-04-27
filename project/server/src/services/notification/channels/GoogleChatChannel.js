/**
 * ============================================================================
 * GOOGLE CHAT CHANNEL — Sends incident alerts to Google Chat
 * ============================================================================
 * Supports two delivery modes:
 *   1. Incoming webhook for a space or direct-message webhook
 *   2. Chat API app-auth flow that finds the direct-message space for a user
 *      by their registered email address and posts the alert there
 * ============================================================================
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CHAT_API_BASE = 'https://chat.googleapis.com/v1';
const GOOGLE_CHAT_SCOPE = 'https://www.googleapis.com/auth/chat.bot';
const SEVERITY_RANK = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
});

class GoogleChatChannel {
  /**
   * @param {Object} config - App config
   */
  constructor(config) {
    this.name = 'google-chat';
    this.webhookUrl = config.GOOGLE_CHAT_WEBHOOK_URL || '';
    this.serviceAccountEmail = config.GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL || '';
    this.privateKey = config.GOOGLE_CHAT_PRIVATE_KEY || '';
    this.minSeverity = String(config.GOOGLE_CHAT_MIN_SEVERITY || 'LOW').toUpperCase();

    this._tokenCache = null;
  }

  isEnabled(incident) {
    if (this._usesUserPreferences(incident)) {
      return Boolean(this._resolvePreferenceWebhookUrl(incident));
    }

    return Boolean(this.webhookUrl || (this.serviceAccountEmail && this.privateKey));
  }

  shouldTrigger(severity, incident) {
    if (this._usesUserPreferences(incident)) {
      return this.isEnabled(incident);
    }

    const current = SEVERITY_RANK[String(severity || 'LOW').toUpperCase()] || 0;
    const minimum = SEVERITY_RANK[this.minSeverity] || SEVERITY_RANK.LOW;
    return current >= minimum;
  }

  async send(incident) {
    const text = this._formatText(incident);
    const resolvedWebhookUrl = this._resolveWebhookUrl(incident);

    if (this._usesUserPreferences(incident)) {
      if (!resolvedWebhookUrl) {
        throw new Error('Google Chat webhook URL is required');
      }

      await axios.post(resolvedWebhookUrl, { text });
      return;
    }

    if (resolvedWebhookUrl) {
      await axios.post(resolvedWebhookUrl, { text });
      return;
    }

    const recipientEmail = String(
      incident.notificationRecipientEmail ||
      incident.recipientEmail ||
      incident.userEmail ||
      ''
    ).trim().toLowerCase();

    if (!recipientEmail) {
      throw new Error('Google Chat recipient email is required');
    }

    const accessToken = await this._getAccessToken();
    const spaceName = await this._findDirectMessageSpace(recipientEmail, accessToken);

    await axios.post(
      `${GOOGLE_CHAT_API_BASE}/${spaceName}/messages`,
      { text },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  _resolveWebhookUrl(incident = {}) {
    if (this._usesUserPreferences(incident)) {
      return this._resolvePreferenceWebhookUrl(incident);
    }

    return this.webhookUrl;
  }

  _resolvePreferenceWebhookUrl(incident = {}) {
    const prefs = incident.notificationPreferences || {};
    if (!prefs.enabled) {
      return '';
    }

    return String(prefs.googleChatWebhookUrl || this.webhookUrl || '').trim();
  }

  _usesUserPreferences(incident = {}) {
    return Boolean(
      incident &&
      incident.notificationPreferences &&
      typeof incident.notificationPreferences === 'object'
    );
  }

  _formatText(incident) {
    return [
      `Incident detected: ${incident.severity || 'UNKNOWN'}`,
      `ID: ${incident.id || 'N/A'}`,
      `Source: ${incident.source || 'unknown'}`,
      `Type: ${incident.type || 'unknown'}`,
      `Message: ${incident.message || ''}`,
      `Playbook: ${incident.playbook || 'manual-triage'}`,
    ].join('\n');
  }

  async _getAccessToken() {
    const nowMs = Date.now();
    if (this._tokenCache && this._tokenCache.expiresAt > nowMs + 60_000) {
      return this._tokenCache.accessToken;
    }

    const nowSec = Math.floor(nowMs / 1000);
    const assertion = jwt.sign(
      {
        iss: this.serviceAccountEmail,
        scope: GOOGLE_CHAT_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: nowSec,
        exp: nowSec + 3600,
      },
      this.privateKey,
      { algorithm: 'RS256' }
    );

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    const { data } = await axios.post(
      GOOGLE_TOKEN_URL,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    this._tokenCache = {
      accessToken: data.access_token,
      expiresAt: nowMs + (Number(data.expires_in || 3600) * 1000),
    };

    return this._tokenCache.accessToken;
  }

  async _findDirectMessageSpace(recipientEmail, accessToken) {
    try {
      const { data } = await axios.get(
        `${GOOGLE_CHAT_API_BASE}/spaces:findDirectMessage`,
        {
          params: {
            name: `users/${recipientEmail}`,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!data?.name) {
        throw new Error('Google Chat direct message space was not returned');
      }

      return data.name;
    } catch (error) {
      throw new Error(
        `Google Chat direct message lookup failed for ${recipientEmail}: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }
}

module.exports = GoogleChatChannel;
