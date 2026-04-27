import React from 'react';

function getBadgeClass(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'badge badge-critical';
    case 'HIGH':
      return 'badge badge-high';
    case 'MEDIUM':
      return 'badge badge-medium';
    case 'LOW':
      return 'badge badge-low';
    default:
      return 'badge';
  }
}

function formatPlaybook(playbook = 'manual-triage') {
  return playbook
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function IncidentList({ incidents, selectedIncident, onSelectIncident }) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="card empty-state" id="incident-list-empty">
        <div className="empty-icon">No incidents</div>
        <div className="empty-text">
          The current report did not produce any incidents for this filter set.
        </div>
      </div>
    );
  }

  return (
    <div className="incident-table-wrapper fade-in" id="incident-list">
      <div className="incident-table-scroll">
        <table className="incident-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Severity</th>
              <th>Type</th>
              <th>Source</th>
              <th>Message</th>
              <th>Playbook</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, index) => (
              <tr
                key={incident.id || index}
                className={selectedIncident?.id === incident.id ? 'is-selected' : ''}
                onClick={() => onSelectIncident(incident)}
              >
                <td className="incident-id">{incident.id}</td>
                <td>
                  <span className={getBadgeClass(incident.severity)}>
                    {incident.severity}
                  </span>
                </td>
                <td>{incident.type || 'unknown'}</td>
                <td>{incident.source || 'unknown'}</td>
                <td className="incident-message-cell" title={incident.message}>
                  {incident.message}
                </td>
                <td className="incident-playbook" title={incident.playbook}>
                  {formatPlaybook(incident.playbook)}
                </td>
                <td>
                  <span className={`badge badge-${(incident.status || 'open').toLowerCase()}`}>
                    {incident.status || 'OPEN'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
