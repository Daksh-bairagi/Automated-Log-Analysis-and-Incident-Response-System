import React from 'react';

export default function SummaryCards({ summary }) {
  const criticalCount =
    summary.critical ?? summary.severityBreakdown?.CRITICAL ?? 0;
  const formattedDate = summary.generatedAt
    ? new Date(summary.generatedAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'No report saved yet';

  const cards = [
    {
      tone: 'entries',
      label: 'Entries processed',
      value: summary.totalEntries.toLocaleString(),
      note: 'Total log lines analyzed in the active report',
    },
    {
      tone: 'incidents',
      label: 'Incidents detected',
      value: summary.totalIncidents.toLocaleString(),
      note: 'Signals that need operator review or automation',
    },
    {
      tone: 'errors',
      label: 'Parse errors',
      value: summary.parseErrors.toLocaleString(),
      note: 'Lines rejected during normalization and parsing',
    },
    {
      tone: 'metrics',
      label: 'Critical entries',
      value: criticalCount.toLocaleString(),
      note: `${summary.incidentRate || '0.00%'} incident rate / ${formattedDate}`,
    },
  ];

  return (
    <div className="summary-grid fade-in" id="summary-cards">
      {cards.map((card) => (
        <article className={`card summary-card ${card.tone}`} key={card.label}>
          <div className="summary-label">{card.label}</div>
          <div className="summary-value">{card.value}</div>
          <div className="summary-note">{card.note}</div>
        </article>
      ))}
    </div>
  );
}
