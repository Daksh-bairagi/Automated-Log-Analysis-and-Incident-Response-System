import React from 'react';

const LEVELS = [
  { key: 'CRITICAL', label: 'Critical', className: 'critical' },
  { key: 'HIGH', label: 'High', className: 'high' },
  { key: 'MEDIUM', label: 'Medium', className: 'medium' },
  { key: 'LOW', label: 'Low', className: 'low' },
];

export default function SeverityBreakdown({ breakdown, total }) {
  return (
    <div className="card severity-section fade-in" id="severity-breakdown">
      <div className="section-header section-header--compact">
        <div>
          <div className="section-eyebrow">Distribution</div>
          <div className="section-title">Severity breakdown</div>
        </div>
        <div className="section-caption">
          {total.toLocaleString()} entries in the active report
        </div>
      </div>

      <div className="severity-bars">
        {LEVELS.map(({ key, label, className }) => {
          const count = breakdown[key] || 0;
          const rawPercent = total === 0 ? 0 : (count / total) * 100;
          const visiblePercent = count > 0 ? Math.max(rawPercent, 4) : 0;

          return (
            <div className="severity-row" key={key}>
              <div className="severity-row-head">
                <span className="severity-row-label">{label}</span>
                <span className="severity-row-meta">
                  {count} entries{total > 0 ? ` / ${Math.round(rawPercent)}%` : ''}
                </span>
              </div>
              <div className="severity-bar-track">
                <div
                  className={`severity-bar-fill ${className}`}
                  style={{ width: `${visiblePercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
