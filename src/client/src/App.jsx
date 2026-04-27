/**
 * ============================================================================
 * APP — Root Application Component
 * ============================================================================
 * The root React component that wraps the entire application with
 * BrowserRouter for client-side routing, AuthProvider for authentication
 * state, and renders AppRoutes.
 * ============================================================================
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
