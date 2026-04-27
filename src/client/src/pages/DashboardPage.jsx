/**
 * ============================================================================
 * DASHBOARD PAGE — Dashboard Route Page
 * ============================================================================
 * Page component for the "/" route. Simply renders the IncidentDashboard
 * feature component. Keeps page-level concerns separate from feature logic.
 * ============================================================================
 */

import React from 'react';
import IncidentDashboard from '../features/dashboard/IncidentDashboard';

export default function DashboardPage() {
  return (
    <div id="dashboard-page">
      <IncidentDashboard />
    </div>
  );
}
