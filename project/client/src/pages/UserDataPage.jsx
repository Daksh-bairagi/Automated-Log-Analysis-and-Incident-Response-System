/**
 * ============================================================================
 * USER DATA PAGE — Display All Stored User Information
 * ============================================================================
 * Shows every field stored in the database for the logged-in user,
 * along with activity statistics from related collections.
 * Clicking a stat card opens a modal with the actual collection data.
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import { getUserData, getCollectionData, updateProfile } from '../services/authApi';
import LoadingSpinner from '../components/LoadingSpinner';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Badge({ children, variant = 'default' }) {
  return <span className={`ud-badge ud-badge--${variant}`}>{children}</span>;
}

function StatCard({ label, value, icon, onClick }) {
  return (
    <div className="ud-stat-card ud-stat-card--clickable" onClick={onClick} role="button" tabIndex={0}>
      <div className="ud-stat-icon">{icon}</div>
      <div className="ud-stat-body">
        <div className="ud-stat-value">{value}</div>
        <div className="ud-stat-label">{label}</div>
      </div>
      <div className="ud-stat-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

function DataRow({ label, children }) {
  return (
    <div className="ud-data-row">
      <span className="ud-data-label">{label}</span>
      <span className="ud-data-value">{children || '—'}</span>
    </div>
  );
}

/* ---- Collection data columns config ---- */
const COLLECTION_COLUMNS = {
  incidents: {
    title: 'Incidents',
    columns: [
      { key: '_id', label: 'ID', mono: true },
      { key: 'severity', label: 'Severity', badge: true },
      { key: 'source', label: 'Source' },
      { key: 'message', label: 'Message', truncate: 80 },
      { key: 'playbook', label: 'Playbook' },
      { key: 'createdAt', label: 'Created', date: true },
    ],
  },
  log_entries: {
    title: 'Log Entries',
    columns: [
      { key: '_id', label: 'ID', mono: true },
      { key: 'severity', label: 'Severity', badge: true },
      { key: 'source', label: 'Source' },
      { key: 'message', label: 'Message', truncate: 80 },
      { key: 'timestamp', label: 'Timestamp', date: true },
    ],
  },
  reports: {
    title: 'Reports',
    columns: [
      { key: '_id', label: 'Report ID', mono: true },
      { key: 'totalEntries', label: 'Entries' },
      { key: 'totalIncidents', label: 'Incidents' },
      { key: 'parseErrors', label: 'Parse Errors' },
      { key: 'createdAt', label: 'Created', date: true },
    ],
  },
  source_documents: {
    title: 'Source Documents',
    columns: [
      { key: '_id', label: 'ID', mono: true },
      { key: 'originalName', label: 'Filename' },
      { key: 'mimeType', label: 'MIME Type' },
      { key: 'size', label: 'Size', bytes: true },
      { key: 'uploadedAt', label: 'Uploaded', date: true },
    ],
  },
};

const SEVERITY_VARIANT = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getCellValue(doc, col) {
  const val = doc[col.key];
  if (val === undefined || val === null) return '—';
  if (col.date) return formatDate(val);
  if (col.bytes) return formatBytes(val);
  if (col.badge) {
    const variant = SEVERITY_VARIANT[String(val).toUpperCase()] || 'default';
    return <Badge variant={variant}>{String(val).toUpperCase()}</Badge>;
  }
  if (col.truncate && String(val).length > col.truncate) {
    return String(val).slice(0, col.truncate) + '…';
  }
  return String(val);
}

/* ---- Collection Data Modal ---- */
function CollectionModal({ collectionKey, onClose }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDoc, setExpandedDoc] = useState(null);

  const config = COLLECTION_COLUMNS[collectionKey];

  useEffect(() => {
    async function load() {
      try {
        const result = await getCollectionData(collectionKey);
        setDocs(result.documents || []);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [collectionKey]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="ud-modal-overlay" onClick={onClose}>
      <div className="ud-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ud-modal-header">
          <div>
            <div className="section-eyebrow">Collection data</div>
            <h2 className="ud-modal-title">{config?.title || collectionKey}</h2>
            {!loading && <p className="ud-modal-count">{docs.length} document{docs.length !== 1 ? 's' : ''} found</p>}
          </div>
          <button className="ud-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="ud-modal-body">
          {loading && (
            <div className="ud-modal-loading">
              <LoadingSpinner label={`Loading ${config?.title || collectionKey}…`} />
            </div>
          )}

          {!loading && error && (
            <div className="feedback-banner feedback-banner--error">
              <strong>Error.</strong>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && docs.length === 0 && (
            <div className="ud-modal-empty">
              <div className="empty-icon">No documents</div>
              <p className="empty-text">This collection is empty for your account.</p>
            </div>
          )}

          {!loading && !error && docs.length > 0 && (
            <div className="ud-modal-table-wrap">
              <table className="ud-modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {config.columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc, i) => (
                    <React.Fragment key={doc._id || i}>
                      <tr
                        className={expandedDoc === doc._id ? 'is-selected' : ''}
                        onClick={() => setExpandedDoc(expandedDoc === doc._id ? null : doc._id)}
                      >
                        <td className="ud-row-num">{i + 1}</td>
                        {config.columns.map((col) => (
                          <td key={col.key} className={col.mono ? 'ud-cell-mono' : ''}>
                            {getCellValue(doc, col)}
                          </td>
                        ))}
                        <td>
                          <button className="ud-expand-btn">
                            {expandedDoc === doc._id ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      {expandedDoc === doc._id && (
                        <tr className="ud-expanded-row">
                          <td colSpan={config.columns.length + 2}>
                            <pre className="ud-expanded-json">
                              {JSON.stringify(doc, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserDataPage() {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);

  // Edit profile state
  const [editName, setEditName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [showPassFields, setShowPassFields] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await getUserData();
        setUserData(result.userData);
        setStats(result.stats);
      } catch (err) {
        setError(err.message || 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Sync editName when userData loads
  useEffect(() => {
    if (userData?.name) setEditName(userData.name);
  }, [userData]);

  const handleProfileUpdate = useCallback(async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    const payload = {};
    if (editName && editName.trim() !== userData?.name) {
      payload.name = editName.trim();
    }
    if (showPassFields && newPassword) {
      if (newPassword !== confirmPassword) {
        setProfileErr('New passwords do not match.');
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }
    if (Object.keys(payload).length === 0) {
      setProfileErr('No changes to save.');
      return;
    }

    setProfileSaving(true);
    try {
      const result = await updateProfile(payload);
      setProfileMsg(result.message || 'Profile updated!');
      if (result.user?.name) {
        setUserData((prev) => ({ ...prev, name: result.user.name }));
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassFields(false);
    } catch (err) {
      setProfileErr(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  }, [editName, userData, showPassFields, currentPassword, newPassword, confirmPassword]);

  const handleCloseModal = useCallback(() => setActiveCollection(null), []);

  const roleVariant = {
    admin: 'critical',
    analyst: 'info',
    viewer: 'muted',
  };

  const providerIcon = {
    local: '🔑',
    google: (
      <svg width="16" height="16" viewBox="0 0 24 24" style={{ verticalAlign: 'middle' }}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  };

  return (
    <div className="page-shell fade-in" id="user-data-page">
      {/* ---- Hero ---- */}
      <section className="hero-panel page-hero">
        <div>
          <div className="section-eyebrow">Database record</div>
          <h1 className="page-title">Your stored user data</h1>
          <p className="page-description">
            Every field persisted in MongoDB for your account, along with
            activity counts from related collections. Click any card to view its data.
          </p>
        </div>
      </section>

      {/* ---- Loading ---- */}
      {loading && (
        <div className="card empty-state">
          <LoadingSpinner label="Fetching user data from database…" />
        </div>
      )}

      {/* ---- Error ---- */}
      {!loading && error && (
        <div className="feedback-banner feedback-banner--error">
          <strong>Unable to load user data.</strong>
          <span>{error}</span>
        </div>
      )}

      {/* ---- Content ---- */}
      {!loading && !error && userData && (
        <>
          {/* Activity Stats — now clickable */}
          <div className="ud-stats-grid">
            <StatCard
              label="Incidents"
              value={stats?.incidents ?? 0}
              onClick={() => setActiveCollection('incidents')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
            />
            <StatCard
              label="Log Entries"
              value={stats?.logEntries ?? 0}
              onClick={() => setActiveCollection('log_entries')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
              }
            />
            <StatCard
              label="Reports"
              value={stats?.reports ?? 0}
              onClick={() => setActiveCollection('reports')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              }
            />
            <StatCard
              label="Source Documents"
              value={stats?.sourceDocuments ?? 0}
              onClick={() => setActiveCollection('source_documents')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              }
            />
          </div>

          {/* User Profile Card */}
          <div className="ud-profile-section">
            <div className="ud-profile-header">
              <div className="ud-avatar-wrap">
                {userData.avatar ? (
                  <img
                    src={userData.avatar}
                    alt={userData.name}
                    className="ud-avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="ud-avatar-fallback">
                    {(userData.name || userData.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="ud-profile-info">
                <h2 className="ud-profile-name">{userData.name}</h2>
                <p className="ud-profile-email">{userData.email}</p>
                <div className="ud-profile-badges">
                  <Badge variant={roleVariant[userData.role] || 'default'}>
                    {userData.role?.toUpperCase()}
                  </Badge>
                  <Badge variant="default">
                    {providerIcon[userData.provider] || '🔑'}{' '}
                    {userData.provider === 'google' ? 'Google' : 'Email / Password'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Fields */}
          <div className="ud-details-grid">
            {/* Identity Section */}
            <section className="card ud-detail-card">
              <div className="section-header section-header--compact">
                <div>
                  <div className="section-eyebrow">Identity</div>
                  <div className="section-title">Account fields</div>
                </div>
              </div>
              <div className="ud-data-list">
                <DataRow label="User ID">{userData.id}</DataRow>
                <DataRow label="Name">{userData.name}</DataRow>
                <DataRow label="Email">{userData.email}</DataRow>
                <DataRow label="Role">{userData.role}</DataRow>
                <DataRow label="Provider">{userData.provider}</DataRow>
                <DataRow label="Google ID">{userData.googleId || '—'}</DataRow>
                <DataRow label="Avatar URL">
                  {userData.avatar ? (
                    <a href={userData.avatar} target="_blank" rel="noreferrer" className="ud-link">
                      {userData.avatar.length > 50
                        ? userData.avatar.slice(0, 50) + '…'
                        : userData.avatar}
                    </a>
                  ) : (
                    '—'
                  )}
                </DataRow>
              </div>
            </section>

            {/* Timestamps Section */}
            <section className="card ud-detail-card">
              <div className="section-header section-header--compact">
                <div>
                  <div className="section-eyebrow">Timestamps</div>
                  <div className="section-title">Record metadata</div>
                </div>
              </div>
              <div className="ud-data-list">
                <DataRow label="Created At">{formatDate(userData.createdAt)}</DataRow>
                <DataRow label="Updated At">{formatDate(userData.updatedAt)}</DataRow>
              </div>
            </section>

            {/* Notification Preferences */}
            <section className="card ud-detail-card ud-detail-card--full">
              <div className="section-header section-header--compact">
                <div>
                  <div className="section-eyebrow">Preferences</div>
                  <div className="section-title">Notification settings</div>
                </div>
              </div>
              <div className="ud-data-list">
                <DataRow label="Notifications Enabled">
                  <Badge variant={userData.notificationPreferences?.enabled ? 'success' : 'muted'}>
                    {userData.notificationPreferences?.enabled ? 'ON' : 'OFF'}
                  </Badge>
                </DataRow>
                <DataRow label="Notification Email">
                  {userData.notificationPreferences?.email || '—'}
                </DataRow>
                <DataRow label="Google Chat Webhook">
                  {userData.notificationPreferences?.googleChatWebhookUrl ? (
                    <a
                      href={userData.notificationPreferences.googleChatWebhookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ud-link"
                    >
                      {userData.notificationPreferences.googleChatWebhookUrl.length > 60
                        ? userData.notificationPreferences.googleChatWebhookUrl.slice(0, 60) + '…'
                        : userData.notificationPreferences.googleChatWebhookUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </DataRow>
              </div>
            </section>
          </div>

          {/* Edit Profile Section */}
          <section className="card ud-edit-section">
            <div className="section-header section-header--compact">
              <div>
                <div className="section-eyebrow">Settings</div>
                <div className="section-title">Edit profile</div>
              </div>
            </div>

            {profileMsg && (
              <div className="feedback-banner feedback-banner--success">
                <strong>Success.</strong>
                <span>{profileMsg}</span>
              </div>
            )}
            {profileErr && (
              <div className="feedback-banner feedback-banner--error">
                <strong>Error.</strong>
                <span>{profileErr}</span>
              </div>
            )}

            <form className="ud-edit-form" onSubmit={handleProfileUpdate}>
              {/* Name field */}
              <div className="ud-edit-field">
                <label htmlFor="edit-name" className="ud-edit-label">Display Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="ud-edit-input"
                  placeholder="Your name"
                />
              </div>

              {/* Password toggle */}
              <button
                type="button"
                className="ud-pass-toggle"
                onClick={() => { setShowPassFields(!showPassFields); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
              >
                {showPassFields ? '✕  Cancel password change' : '🔒  Change password'}
              </button>

              {showPassFields && (
                <div className="ud-pass-fields">
                  <div className="ud-edit-field">
                    <label htmlFor="current-password" className="ud-edit-label">Current Password</label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="ud-edit-input"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="ud-edit-field">
                    <label htmlFor="new-password" className="ud-edit-label">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="ud-edit-input"
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="ud-edit-field">
                    <label htmlFor="confirm-password" className="ud-edit-label">Confirm New Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="ud-edit-input"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              <div className="ud-edit-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileSaving}
                >
                  {profileSaving ? (
                    <><span className="spinner spinner--sm"></span> Saving…</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {/* ---- Collection Data Modal ---- */}
      {activeCollection && (
        <CollectionModal
          collectionKey={activeCollection}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
