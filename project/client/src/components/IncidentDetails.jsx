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

export default function IncidentDetails({ incident, onClose }) {
  if (!incident) return null;

  const actions =
    incident.actions && incident.actions.length > 0
      ? incident.actions
      : ['No response actions recorded yet.'];

  return (
    <section className="card detail-panel fade-in" id="incident-details">
      <div className="detail-header">
        <div>
          <div className="section-eyebrow">Selected incident</div>
          <h3 className="detail-id">{incident.id}</h3>
        </div>

        <div className="detail-header-actions">
          <span className={getBadgeClass(incident.severity)}>{incident.severity}</span>
          <span className={`badge badge-${(incident.status || 'open').toLowerCase()}`}>
            {incident.status || 'OPEN'}
          </span>
          <button className="btn btn-tertiary" onClick={onClose} id="close-details">
            Close
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-field">
          <div className="field-label">Source</div>
          <div className="field-value">{incident.source || 'unknown'}</div>
        </div>
        <div className="detail-field">
          <div className="field-label">Timestamp</div>
          <div className="field-value">{incident.timestamp || 'Not captured'}</div>
        </div>
        <div className="detail-field">
          <div className="field-label">Type</div>
          <div className="field-value">{incident.type || 'unknown'}</div>
        </div>
        <div className="detail-field">
          <div className="field-label">Priority</div>
          <div className="field-value">{incident.priority || 'P4'}</div>
        </div>
        <div className="detail-field">
          <div className="field-label">Playbook</div>
          <div className="field-value">{formatPlaybook(incident.playbook)}</div>
        </div>
        <div className="detail-field">
          <div className="field-label">Action count</div>
          <div className="field-value">{actions.length}</div>
        </div>
      </div>

      <div className="detail-block">
        <div className="field-label">Reason</div>
        <div className="field-value">
          {incident.reason || 'No explicit reason captured for this incident.'}
        </div>
      </div>

      <div className="detail-block detail-block--message">
        <div className="field-label">Message</div>
        <div className="field-value detail-message">{incident.message}</div>
      </div>

      <div className="detail-block">
        <div className="field-label">Recommended actions</div>
        <ul className="action-list">
          {actions.map((action, index) => (
            <li className="action-item" key={index}>
              {action}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
