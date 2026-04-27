import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function UserProfileModal({ onClose, onLogout }) {
  const { user, updateNotificationPreferences } = useAuth();
  const modalRef = useRef(null);

  // ---- Notification form state ----
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Populate from user preferences on open
  useEffect(() => {
    if (user?.notificationPreferences) {
      setWebhookUrl(user.notificationPreferences.googleChatWebhookUrl || '');
      setNotifEnabled(
        user.notificationPreferences.enabled !== false
      );
    }
  }, [user]);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasWebhook = Boolean(webhookUrl.trim());
  const userEmail = user?.email || '';

  async function handleSave(e) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    try {
      setSaving(true);
      await updateNotificationPreferences({
        enabled: notifEnabled,
        email: userEmail,
        googleChatWebhookUrl: webhookUrl.trim(),
      });
      setSaveSuccess('Settings saved.');
    } catch (err) {
      setSaveError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const initials = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="User profile">
      <div className="profile-modal" ref={modalRef}>
        {/* ---- Header ---- */}
        <div className="profile-modal-header">
          <div className="profile-modal-avatar">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" />
              : <span>{initials}</span>
            }
          </div>
          <div className="profile-modal-identity">
            <span className="profile-modal-name">{user?.name || 'User'}</span>
            <span className="profile-modal-email">{userEmail}</span>
            {user?.role && (
              <span className="profile-modal-role">{user.role}</span>
            )}
          </div>
          <button className="profile-modal-close" onClick={onClose} aria-label="Close profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="profile-modal-divider" />

        {/* ---- Notification Settings ---- */}
        <div className="profile-modal-section">
          <div className="profile-notif-header">
            <div>
              <div className="profile-notif-eyebrow">Alert Delivery</div>
              <div className="profile-notif-title">Notification settings</div>
            </div>
            <div className="profile-notif-toggle-wrap">
              <span className={`notif-pill ${notifEnabled ? 'is-on' : 'is-off'}`}>
                {notifEnabled ? 'Notifications on' : 'Notifications off'}
              </span>
              <label className="notification-toggle" htmlFor="profile-notif-enabled">
                <input
                  id="profile-notif-enabled"
                  type="checkbox"
                  checked={notifEnabled}
                  onChange={(e) => {
                    setSaveError('');
                    setSaveSuccess('');
                    setNotifEnabled(e.target.checked);
                  }}
                />
                <span className="notification-toggle-track" aria-hidden="true">
                  <span className="notification-toggle-thumb" />
                </span>
              </label>
            </div>
          </div>

          <form onSubmit={handleSave} className="profile-notif-form">
            {/* Email — locked to account email */}
            <div className="profile-form-field">
              <label className="profile-field-label">
                Registered email
                <span className="profile-field-badge">read-only</span>
              </label>
              <div className="profile-email-display">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span>{userEmail || 'No account email'}</span>
              </div>
            </div>

            {/* Google Chat Webhook */}
            <div className="profile-form-field">
              <label className="profile-field-label" htmlFor="profile-gchat-webhook">
                Google Chat webhook
                {hasWebhook && (
                  <span className="profile-field-badge profile-field-badge--active">active</span>
                )}
              </label>
              <input
                id="profile-gchat-webhook"
                type="url"
                className="profile-input"
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setSaveSuccess(''); setSaveError(''); }}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                autoComplete="off"
              />
              {hasWebhook && notifEnabled && (
                <span className="profile-field-hint profile-field-hint--active">
                  ✓ Incidents will be posted to this Google Chat space
                </span>
              )}
              {!hasWebhook && notifEnabled && (
                <span className="profile-field-hint">
                  Paste a webhook URL to enable Google Chat alerts
                </span>
              )}
            </div>

            {/* Active channels summary */}
            <div className="profile-channels-row">
              {notifEnabled
                ? (
                  <span className="profile-channels-label">
                    Active channels:&nbsp;
                    <strong>
                      {[
                        userEmail && 'Email',
                        hasWebhook && 'Google Chat',
                      ].filter(Boolean).join(' + ') || '—'}
                    </strong>
                  </span>
                )
                : <span className="profile-channels-label">Notifications are off — no alerts will be sent.</span>
              }
            </div>

            {saveError && (
              <div className="profile-feedback profile-feedback--error">{saveError}</div>
            )}
            {saveSuccess && (
              <div className="profile-feedback profile-feedback--success">{saveSuccess}</div>
            )}

            <div className="profile-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="profile-modal-divider" />

        {/* ---- Sign out ---- */}
        <div className="profile-modal-footer">
          <button className="profile-signout-btn" onClick={onLogout} id="profile-logout-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
