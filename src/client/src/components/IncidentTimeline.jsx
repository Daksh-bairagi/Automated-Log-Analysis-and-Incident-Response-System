/**
 * ============================================================================
 * INCIDENT TIMELINE — Chronological Incident Visualization
 * ============================================================================
 * Renders incidents as a vertical timeline sorted by timestamp.
 * Each node shows severity badge, time, source, message, and playbook.
 * ============================================================================
 */
import React, { useMemo } from 'react';

/**
 * @param {Object}   props
 * @param {Object[]} props.incidents - Array of incident records
 */
export default function IncidentTimeline({ incidents = [] }) {
  const sorted = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
  }, [incidents]);

  const severityColor = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e',
  };

  if (incidents.length === 0) {
    return (
      <div className="card fade-in" id="incident-timeline" style={styles.card}>
        <div className="card-title">🕐 Incident Timeline</div>
        <div style={styles.empty}>
          <div style={{ fontSize: '2rem' }}>🛡️</div>
          <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>No incidents to display</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in" id="incident-timeline" style={styles.card}>
      <div className="card-title">🕐 Incident Timeline</div>
      <div style={styles.timeline}>
        {sorted.map((inc, i) => {
          const color = severityColor[inc.severity] || severityColor.LOW;
          const isLast = i === sorted.length - 1;

          return (
            <div key={inc.id || i} style={styles.item} id={`timeline-item-${i}`}>
              {/* ---- Connector line ---- */}
              <div style={styles.connectorCol}>
                <div style={{ ...styles.dot, background: color, boxShadow: `0 0 8px ${color}80` }} />
                {!isLast && <div style={styles.line} />}
              </div>

              {/* ---- Content ---- */}
              <div style={{ ...styles.content, borderLeft: `2px solid ${color}30` }}>
                <div style={styles.header}>
                  <span style={{ ...styles.badge, background: color + '22', color, border: `1px solid ${color}` }}>
                    {inc.severity}
                  </span>
                  <span style={styles.incId}>{inc.id || `INC-${i + 1}`}</span>
                  <span style={styles.time}>
                    {inc.timestamp
                      ? (() => { try { return new Date(inc.timestamp).toLocaleTimeString(); } catch { return inc.timestamp; } })()
                      : '—'}
                  </span>
                </div>
                <div style={styles.source}>{inc.source || 'unknown'}</div>
                <div style={styles.message}>{inc.message}</div>
                {inc.playbook && (
                  <div style={styles.playbook}>📋 {inc.playbook}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  card: { padding: '1.25rem' },
  empty: { textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 0, marginTop: '0.75rem' },
  item: { display: 'flex', gap: '0.75rem', position: 'relative' },
  connectorCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '18px' },
  dot: { width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, marginTop: '0.2rem', zIndex: 1 },
  line: { flex: 1, width: '2px', background: 'var(--border, #374151)', minHeight: '1.5rem' },
  content: {
    flex: 1, marginLeft: '0.5rem', padding: '0.6rem 0.75rem',
    borderRadius: '0 8px 8px 0', marginBottom: '0.75rem',
    background: 'var(--surface-raised, #1f2937)',
  },
  header: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' },
  badge: {
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
    padding: '1px 6px', borderRadius: '4px',
  },
  incId: { fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' },
  time: { fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' },
  source: { fontSize: '0.78rem', color: 'var(--accent-blue, #3b82f6)', marginBottom: '0.2rem' },
  message: { fontSize: '0.875rem', color: 'var(--text, #e5e7eb)', lineHeight: 1.4 },
  playbook: { marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' },
};
