import React from 'react';
import useIncidentDashboard from '../../hooks/useIncidentDashboard';
import DashboardActions from '../../components/DashboardActions';
import SummaryCards from '../../components/SummaryCards';
import SeverityBreakdown from '../../components/SeverityBreakdown';
import IncidentFilters from '../../components/IncidentFilters';
import IncidentList from '../../components/IncidentList';
import IncidentDetails from '../../components/IncidentDetails';
import AnalyzedFileList from '../../components/AnalyzedFileList';
import StoredUploadList from '../../components/StoredUploadList';

export default function IncidentDashboard() {
  const {
    summary,
    incidents,
    allIncidents,
    logFiles,
    uploads,
    view,
    loading,
    error,
    selectedIncident,
    setSelectedIncident,
    severityFilter,
    setSeverityFilter,
    searchQuery,
    setSearchQuery,
    handleRunAnalysis,
    handleUploadAnalysis,
    handleLoadLatest,
  } = useIncidentDashboard();

  return (
    <div className="page-shell fade-in" id="incident-dashboard">
      <DashboardActions
        onRunAnalysis={handleRunAnalysis}
        onLoadLatest={handleLoadLatest}
        onUpload={handleUploadAnalysis}
        loading={loading}
      />


      {error && (
        <div className="feedback-banner feedback-banner--error" id="error-display">
          <strong>Request failed.</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="card empty-state" id="loading-state">
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
          <div className="empty-text">Analyzing log sources and building the report...</div>
        </div>
      )}

      {summary.totalEntries > 0 && !loading && (
        <div className="dashboard-results">
          <div className="section-header">
            <div>
              <div className="section-eyebrow">Latest snapshot</div>
              <div className="section-title">System health at a glance</div>
            </div>
            <div className="section-caption">
              Review the current report summary before diving into the incident queue.
            </div>
          </div>

          <SummaryCards summary={summary} />
          <SeverityBreakdown
            breakdown={summary.severityBreakdown}
            total={summary.totalEntries}
          />

          {selectedIncident && (
            <IncidentDetails
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          )}

          <div className="section-header">
            <div>
              <div className="section-eyebrow">Investigation queue</div>
              <div className="section-title">Detected incidents</div>
            </div>
            <div className="section-caption">
              Filter the queue, inspect messages, and open the selected record for detail.
            </div>
          </div>

          <IncidentFilters
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalCount={allIncidents.length}
            filteredCount={incidents.length}
          />

          <IncidentList
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
          />

          <div className="two-col-grid">
            <AnalyzedFileList files={view?.analyzedFiles || logFiles} />
            <StoredUploadList uploads={uploads} />
          </div>
        </div>
      )}

      {!loading && summary.totalEntries === 0 && !error && (
        <div className="card empty-state" id="initial-state">
          <div className="empty-icon">Ready for analysis</div>
          <div className="empty-text">
            Start with the default server logs or upload a smaller evidence set to build your
            first report.
          </div>
        </div>
      )}
    </div>
  );
}
