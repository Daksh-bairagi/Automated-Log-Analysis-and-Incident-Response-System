import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_FORM = {
  enabled: false,
  email: '',
  googleChatWebhookUrl: '',
};

export default function NotificationSettingsCard() {
  const { user, updateNotificationPreferences, sendTestEmail } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const emailCapability = user?.notificationCapabilities?.email || {
    available: false,
    message: 'Email delivery is unavailable until SMTP or Resend is configured in server/.env.',
  };
  const registeredEmailCapability = user?.notificationCapabilities?.registeredEmail || {
    available: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(user?.email || '').trim()),
    message: 'Registered email availability is unknown.',
  };
  const emailAvailable = emailCapability.available !== false;
  const registeredEmailValid = registeredEmailCapability.available !== false;
  const hasChatWebhook = Boolean(form.googleChatWebhookUrl.trim());
  const canEnableNotifications =
    hasChatWebhook ||
    (emailAvailable && registeredEmailValid && Boolean(user?.email));

  useEffect(() => {
    const prefs = user?.notificationPreferences || EMPTY_FORM;
    setForm({
      enabled: Boolean(prefs.enabled),
      email: user?.email || prefs.email || '',
      googleChatWebhookUrl: prefs.googleChatWebhookUrl || '',
    });
  }, [user]);

  const activeChannels = !form.enabled
    ? []
    : [
        emailAvailable && registeredEmailValid && user?.email ? 'Email' : null,
        hasChatWebhook ? 'Google Chat' : null,
      ].filter(Boolean);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleToggle(enabled) {
    setError('');
    setSuccess('');

    if (enabled && !canEnableNotifications) {
      setForm((current) => ({
        ...current,
        enabled: false,
      }));
      setError(
        emailAvailable
          ? 'Add a valid registered email or Google Chat webhook before turning notifications on.'
          : 'Email needs SMTP or Resend configured in server/.env first. Google Chat can still work now if you paste a webhook.'
      );
      return;
    }

    updateField('enabled', enabled);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      enabled: form.enabled,
      email: (user?.email || '').trim().toLowerCase(),
      googleChatWebhookUrl: form.googleChatWebhookUrl.trim(),
    };

    if (payload.enabled && !payload.email && !payload.googleChatWebhookUrl) {
      setError('Your account email is missing. Add a Google Chat webhook or update your account email.');
      return;
    }

    if (payload.enabled && payload.email && !registeredEmailValid) {
      setError(registeredEmailCapability.message || 'Your registered account email is not valid.');
      return;
    }

    if (payload.enabled && payload.email && !payload.googleChatWebhookUrl && !emailAvailable) {
      setError(emailCapability.message || 'Email delivery is unavailable on this server.');
      setForm((current) => ({
        ...current,
        enabled: false,
      }));
      return;
    }

    try {
      setSaving(true);
      await updateNotificationPreferences(payload);
      setSuccess('Notification preferences saved.');
    } catch (err) {
      setError(err.message || 'Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setError('');
    setSuccess('');

    if (!registeredEmailValid) {
      setError(registeredEmailCapability.message || 'Your registered account email is not valid.');
      return;
    }

    try {
      setTestingEmail(true);
      const result = await sendTestEmail();
      setSuccess(result.message || 'Test email sent.');
    } catch (err) {
      setError(err.message || 'Test email failed.');
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <section className="card notification-settings-card" id="notification-settings">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Alert Delivery</div>
          <div className="section-title">Personal notification settings</div>
        </div>
        <div className="notification-status-block">
          <span className={`notification-status-pill ${form.enabled ? 'is-on' : 'is-off'}`}>
            {form.enabled ? 'Notifications on' : 'Notifications off'}
          </span>
          <label className="notification-toggle" htmlFor="notification-enabled">
            <input
              id="notification-enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => handleToggle(event.target.checked)}
            />
            <span className="notification-toggle-track" aria-hidden="true">
              <span className="notification-toggle-thumb" />
            </span>
          </label>
        </div>
      </div>
      {!registeredEmailValid && (
        <div className="feedback-banner feedback-banner--error">
          <strong>Invalid account email.</strong>
          <span>{registeredEmailCapability.message}</span>
        </div>
      )}

      {!emailAvailable && (
        <div className="feedback-banner feedback-banner--error">
          <strong>Email unavailable.</strong>
          <span>{emailCapability.message}</span>
        </div>
      )}

      <form className="notification-settings-form" onSubmit={handleSubmit}>
        <div className="notification-settings-grid">
          <label className="form-field">
            <span className="field-label">Registered email destination</span>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              placeholder="No account email found"
              autoComplete="email"
            />
          </label>

          <label className="form-field">
            <span className="field-label">Google Chat webhook</span>
            <input
              type="url"
              value={form.googleChatWebhookUrl}
              onChange={(event) => updateField('googleChatWebhookUrl', event.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/..."
              autoComplete="off"
            />
          </label>
        </div>

        <div className="notification-helper-row">
          <div className="notification-helper-copy">
            {activeChannels.length > 0
              ? `Active channels: ${activeChannels.join(' + ')}`
              : emailAvailable
                ? 'No usable delivery channel is currently selected.'
                : 'Email needs SMTP or Resend configured in server/.env. Google Chat can work now if you paste a webhook.'}
          </div>
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={handleTestEmail}
            disabled={testingEmail || !user?.email || !emailAvailable}
          >
            {testingEmail ? 'Testing email...' : 'Send test email'}
          </button>
        </div>

        {error && (
          <div className="feedback-banner feedback-banner--error">
            <strong>Save failed.</strong>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="feedback-banner feedback-banner--success">
            <strong>Saved.</strong>
            <span>{success}</span>
          </div>
        )}

        <div className="notification-submit-row">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save notification settings'}
          </button>
        </div>
      </form>
    </section>
  );
}
