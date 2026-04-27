import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserProfileModal from '../components/UserProfileModal';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/stream-ingest', label: 'Stream Ingest' },
  { to: '/upload', label: 'Upload' },
  { to: '/user-data', label: 'My Data' },
];

export default function MainLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="app-layout" id="app-layout">
      <header className="app-header">
        <div className="header-content">
          <Link to="/" className="header-brand">
            <span className="logo-icon">LA</span>
            <span className="brand-copy">
              <span className="brand-title">Log Analyzer</span>
              <span className="brand-subtitle">Incident response cockpit</span>
            </span>
          </Link>

          <div className="header-actions">
            <nav className="header-nav" aria-label="Primary">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {user && (
              <div className="user-menu-wrap">
                <button
                  className="user-avatar-btn"
                  onClick={() => setProfileOpen(true)}
                  id="user-menu-toggle"
                  aria-label="Open user profile"
                  aria-haspopup="dialog"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="user-avatar-img"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="user-avatar-fallback">
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      {profileOpen && (
        <UserProfileModal
          onClose={() => setProfileOpen(false)}
          onLogout={() => { setProfileOpen(false); logout(); }}
        />
      )}
    </div>
  );
}
