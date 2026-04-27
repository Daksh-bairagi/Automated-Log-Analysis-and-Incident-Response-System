import React from 'react';

export default function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  inline = false,
}) {
  const className = `spinner ${size === 'sm' ? 'spinner--sm' : size === 'lg' ? 'spinner--lg' : ''}`;

  if (inline) {
    return (
      <span className="spinner-inline" role="status" aria-label={label}>
        <span className={className} aria-hidden="true" />
      </span>
    );
  }

  return (
    <div className="loading-spinner-wrap fade-in" role="status" aria-label={label}>
      <span className={className} aria-hidden="true" />
      <span className="loading-spinner-label">{label}</span>
    </div>
  );
}
