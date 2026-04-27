'use strict';

const crypto = require('crypto');

const VERSION = 'v1';

function deriveKey(secret) {
  return crypto
    .createHash('sha256')
    .update(String(secret || 'log-analyzer-local-secret'))
    .digest();
}

function encryptSecret(value, secret) {
  const plaintext = String(value || '');
  if (!plaintext) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptSecret(value, secret) {
  const payload = String(value || '');
  if (!payload) return '';

  const [version, ivBase64, tagBase64, encryptedBase64] = payload.split(':');
  if (version !== VERSION || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('Unsupported encrypted secret format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
