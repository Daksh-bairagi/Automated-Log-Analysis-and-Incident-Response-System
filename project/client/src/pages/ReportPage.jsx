import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadLatestReport, getLatestReport } from '../services/incidentApi';
import SummaryCards from '../components/SummaryCards';
import SeverityBreakdown from '../components/SeverityBreakdown';
import IncidentList from '../components/IncidentList';
import IncidentDetails from '../components/IncidentDetails';
import AnalyzedFileList from '../components/AnalyzedFileList';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ReportPage() {
  const [report, setReport] = useState(null);
  const [view, setView] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);

  useEffect(() => {
    async function loadLatest() {
      try {
        const result = await getLatestReport();
        setReport(result.report);
        setView(result.view);
      } catch (err) {
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    loadLatest();
  }, []);

  const exportReport = async (format) => {
    try {
      setExportError(null);
      setExportingFormat(format);
      await downloadLatestReport(format);
    } catch (err) {
      setExportError(err.message || `Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const summary = view?.summary || {
    totalEntries: 0,
    totalIncidents: 0,
    parseErrors: 0,
    generatedAt: null,
    severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    incidentRate: '0.00%',
  };

  return (
    <div className="page-shell fade-in" id="report-page">
      <section className="hero-panel page-hero">
        <div>
          <div className="section-eyebrow">Saved output</div>
          <h1 className="page-title">Review the latest generated report.</h1>
          <p className="page-description">
            Export the current snapshot, inspect the incident queue, and confirm the
            latest analysis landed with the expected coverage.
          </p>
        </div>
        <div className="actions-bar">
          <button
            className="btn btn-secondary"
            onClick={() => exportReport('csv')}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => exportReport('pdf')}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </section>

      {exportError ? (
        <div className="feedback-banner feedback-banner--error">
          <strong>Export failed.</strong>
          <span>{exportError}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="card empty-state">
          <LoadingSpinner label="Loading the latest report..." />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="feedback-banner feedback-banner--error">
          <strong>Unable to load the latest report.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error && (!report || !view) ? (
        <div className="card empty-state">
          <div className="empty-icon">No saved report yet</div>
          <div className="empty-text">
            Run an analysis or upload evidence first so there is a report to review.
          </div>
          <Link to="/upload" className="btn btn-primary">
            Go to upload
          </Link>
        </div>
      ) : null}

      {!loading && !error && report && view ? (
        <>
          <SummaryCards summary={summary} />
          <SeverityBreakdown breakdown={summary.severityBreakdown} total={summary.totalEntries} />

          {selectedIncident ? (
            <IncidentDetails incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
          ) : null}

          <div className="section-header">
            <div>
              <div className="section-eyebrow">Investigation queue</div>
              <div className="section-title">Report incidents</div>
            </div>
            <div className="section-caption">
              Open an incident to inspect the captured context and recommended actions.
            </div>
          </div>

          <IncidentList
            incidents={view.incidents || report.incidents || []}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
          />

          <div className="two-col-grid">
            <AnalyzedFileList files={view.analyzedFiles || report.logFiles || []} />

            <section className="card report-metrics-card">
              <div className="section-header section-header--compact">
                <div>
                  <div className="section-eyebrow">Metrics</div>
                  <div className="section-title">Report details</div>
                </div>
              </div>

              <div className="metric-list">
                <div className="metric-item">
                  <span>Incident rate</span>
                  <strong>{summary.incidentRate || report.metrics?.incidentRate || '0.00%'}</strong>
                </div>
                <div className="metric-item">
                  <span>Critical entries</span>
                  <strong>{summary.critical ?? report.metrics?.criticalCount ?? 0}</strong>
                </div>
                <div className="metric-item">
                  <span>Parse errors</span>
                  <strong>{summary.parseErrors ?? report.parseErrors ?? 0}</strong>
                </div>
                <div className="metric-item">
                  <span>Generated at</span>
                  <strong>
                    {summary.generatedAt
                      ? new Date(summary.generatedAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Not recorded'}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
