/**
 * ============================================================================
 * AUTH API — Client-side authentication service
 * ============================================================================
 * All HTTP calls related to authentication (register, login, Google, profile).
 * Uses the shared apiClient for consistent error handling.
 * ============================================================================
 */

import apiClient from './apiClient';

/**
 * Register a new user with email and password.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ success: boolean, token: string, user: Object }>}
 */
export async function registerUser({ name, email, password }) {
  return apiClient.post('/api/auth/register', { name, email, password });
}

/**
 * Login with email and password.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ success: boolean, token: string, user: Object }>}
 */
export async function loginUser({ email, password }) {
  return apiClient.post('/api/auth/login', { email, password });
}

/**
 * Authenticate with a Google ID token (from Google Identity Services).
 * @param {{ credential: string }} data
 * @returns {Promise<{ success: boolean, token: string, user: Object }>}
 */
export async function googleAuth({ credential }) {
  return apiClient.post('/api/auth/google', { credential });
}

/**
 * Fetch the current authenticated user profile.
 * @returns {Promise<{ success: boolean, user: Object }>}
 */
export async function getMe() {
  return apiClient.get('/api/auth/me');
}

/**
 * Update the current user's notification preferences.
 * @param {{ enabled: boolean, email: string, googleChatWebhookUrl: string }} notificationPreferences
 * @returns {Promise<{ success: boolean, user: Object }>}
 */
export async function updateNotificationPreferences(notificationPreferences) {
  return apiClient.put('/api/auth/notifications', { notificationPreferences });
}

/**
 * Send a test email to the current user's registered email address.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function sendTestNotificationEmail() {
  return apiClient.post('/api/auth/notifications/test-email');
}

/**
 * Fetch full user data including all stored fields and collection stats.
 * @returns {Promise<{ success: boolean, userData: Object, stats: Object }>}
 */
export async function getUserData() {
  return apiClient.get('/api/auth/user-data');
}

/**
 * Fetch documents from a specific collection for the current user.
 * @param {'incidents'|'log_entries'|'reports'|'source_documents'} collection
 * @returns {Promise<{ success: boolean, collection: string, count: number, documents: Object[] }>}
 */
export async function getCollectionData(collection) {
  return apiClient.get(`/api/auth/user-data/${encodeURIComponent(collection)}`);
}

/**
 * Update the current user's name and/or password.
 * @param {{ name?: string, currentPassword?: string, newPassword?: string }} data
 * @returns {Promise<{ success: boolean, message: string, user: Object }>}
 */
export async function updateProfile(data) {
  return apiClient.put('/api/auth/update-profile', data);
}
