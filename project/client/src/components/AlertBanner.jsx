import React, { useCallback, useEffect, useState } from 'react';

function formatLabel(value = '') {
  if (!value) return 'Critical incident';
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export default function AlertBanner({ incident, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      onDismiss?.();
    }, 220);
  }, [onDismiss]);

  useEffect(() => {
    if (!incident) return undefined;

    const timer = setTimeout(() => {
      dismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, [dismiss, incident]);

  if (!incident) return null;

  return (
    <aside
      className={`alert-banner ${leaving ? 'is-leaving' : 'is-visible'}`}
      id="alert-banner"
      role="alert"
      aria-live="assertive"
    >
      <div className="alert-banner-tag">Critical alert</div>
      <div className="alert-banner-content">
        <div className="alert-banner-heading">{formatLabel(incident.type)}</div>
        <div className="alert-banner-meta">
          {(incident.severity || 'CRITICAL').toUpperCase()} / {incident.source || 'unknown'}
          {incident.playbook ? ` / ${incident.playbook}` : ''}
        </div>
        <p className="alert-banner-copy">
          {incident.message || 'A critical incident has been detected in the live stream.'}
        </p>
      </div>
      <button
        type="button"
        className="alert-banner-close"
        onClick={dismiss}
        id="alert-banner-dismiss"
      >
        Dismiss
      </button>
    </aside>
  );
}
