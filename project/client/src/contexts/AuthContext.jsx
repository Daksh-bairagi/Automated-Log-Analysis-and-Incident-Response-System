/* eslint-disable react-refresh/only-export-components */
/**
 * ============================================================================
 * AUTH CONTEXT — Global Authentication State
 * ============================================================================
 * Provides user state, login/logout actions, and Google One-Tap initialization
 * to the entire React app via Context API.
 *
 * FEATURES:
 *   - Persists JWT in localStorage
 *   - Auto-restores session on page reload (calls /api/auth/me)
 *   - Initializes Google Identity Services for one-tap/button sign-in
 *   - Exposes: user, loading, login, register, loginWithGoogle, logout
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  registerUser,
  loginUser,
  googleAuth,
  getMe,
  updateNotificationPreferences as saveNotificationPreferences,
  sendTestNotificationEmail,
} from '../services/authApi';

const AuthContext = createContext(null);

const TOKEN_KEY = 'log_analyzer_token';

// Your Google Client ID — set this in your .env as VITE_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFreshProfile = useCallback(async () => {
    const profile = await getMe();
    setUser(profile.user);
    return profile.user;
  }, []);

  const handleGoogleResponse = useCallback(async (response) => {
    try {
      setLoading(true);
      const data = await googleAuth({ credential: response.credential });
      localStorage.setItem(TOKEN_KEY, data.token);
      try {
        await loadFreshProfile();
      } catch (_) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('[Auth] Google sign-in failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [loadFreshProfile]);

  // ---- Restore session on mount ----
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      getMe()
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ---- Initialize Google Identity Services ----
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };

    // If script already loaded
    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      // Wait for the GIS script to load
      window.addEventListener('load', initGoogle);
      return () => window.removeEventListener('load', initGoogle);
    }
  }, [handleGoogleResponse]);

  const login = useCallback(async ({ email, password }) => {
    const data = await loginUser({ email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    try {
      const user = await loadFreshProfile();
      return { ...data, user };
    } catch (_) {
      setUser(data.user);
      return data;
    }
  }, [loadFreshProfile]);

  const register = useCallback(async ({ name, email, password }) => {
    const data = await registerUser({ name, email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    try {
      const user = await loadFreshProfile();
      return { ...data, user };
    } catch (_) {
      setUser(data.user);
      return data;
    }
  }, [loadFreshProfile]);

  const loginWithGoogle = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    // Revoke Google session if available
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    return loadFreshProfile();
  }, [loadFreshProfile]);

  const updateNotificationPreferences = useCallback(async (notificationPreferences) => {
    const data = await saveNotificationPreferences(notificationPreferences);
    try {
      const user = await loadFreshProfile();
      return { ...data, user };
    } catch (_) {
      setUser(data.user);
      return data;
    }
  }, [loadFreshProfile]);

  const sendTestEmail = useCallback(async () => {
    return sendTestNotificationEmail();
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    loginWithGoogle,
    handleGoogleResponse,
    logout,
    refreshProfile,
    updateNotificationPreferences,
    sendTestEmail,
    GOOGLE_CLIENT_ID,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
