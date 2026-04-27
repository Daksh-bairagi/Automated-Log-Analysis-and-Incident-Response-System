import React, { useState } from 'react';
import UploadZone from '../components/UploadZone';
import SummaryCards from '../components/SummaryCards';
import SeverityBreakdown from '../components/SeverityBreakdown';
import IncidentList from '../components/IncidentList';
import IncidentDetails from '../components/IncidentDetails';
import AnalyzedFileList from '../components/AnalyzedFileList';
import StoredUploadList from '../components/StoredUploadList';

export default function UploadPage() {
  const [result, setResult] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const summary = result?.view?.summary || {
    totalEntries: 0,
    totalIncidents: 0,
    parseErrors: 0,
    generatedAt: null,
    severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    incidentRate: '0.00%',
  };

  return (
    <div className="page-shell fade-in" id="upload-page">
      <section className="hero-panel page-hero">
        <div>
          <div className="section-eyebrow">Evidence intake</div>
          <h1 className="page-title">Upload files for a focused investigation.</h1>
          <p className="page-description">
            Run ad hoc analysis on a curated batch of `.log` or `.pdf` files without
            touching the default monitored directory.
          </p>
        </div>
        <div className="page-side-note">
          Each upload is stored with source metadata so the document history remains
          traceable after analysis completes.
        </div>
      </section>

      <UploadZone
        onResult={(nextResult) => {
          setResult(nextResult);
          setSelectedIncident(null);
        }}
      />

      {result?.view ? (
        <>
          <div className="section-header">
            <div>
              <div className="section-eyebrow">Analysis results</div>
              <div className="section-title">Uploaded evidence summary</div>
            </div>
            <div className="section-caption">
              Review the saved report generated from the current upload batch.
            </div>
          </div>

          <SummaryCards summary={summary} />
          <SeverityBreakdown breakdown={summary.severityBreakdown} total={summary.totalEntries} />

          {selectedIncident ? (
            <IncidentDetails
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          ) : null}

          <div className="section-header">
            <div>
              <div className="section-eyebrow">Investigation queue</div>
              <div className="section-title">Detected incidents</div>
            </div>
            <div className="section-caption">
              Inspect the incidents produced by this upload run.
            </div>
          </div>

          <IncidentList
            incidents={result.incidents || []}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
          />

          <div className="two-col-grid">
            <AnalyzedFileList files={result.view.analyzedFiles || result.logFiles || []} />
            <StoredUploadList uploads={result.storedUploads || result.uploads || []} />
          </div>
        </>
      ) : null}
    </div>
  );
}
