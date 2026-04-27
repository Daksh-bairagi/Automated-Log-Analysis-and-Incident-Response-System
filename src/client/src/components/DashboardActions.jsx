import React, { useRef, useState } from 'react';

export default function DashboardActions({ onRunAnalysis, onLoadLatest, onUpload, loading }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onUpload(files);
    }
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);

    const files = Array.from(event.dataTransfer.files || []).filter(
      (file) => file.name.endsWith('.log') || file.name.endsWith('.pdf')
    );

    if (files.length > 0) {
      onUpload(files);
    }
  };

  return (
    <section className="hero-panel dashboard-hero" id="dashboard-actions">
      <div className="dashboard-hero-copy">
        <div className="section-eyebrow">Operations overview</div>
        <h2 className="page-title">Run the pipeline or bring in fresh evidence.</h2>
        <p className="page-description">
          Analyze the monitored server log directory, reload the latest saved report, or
          upload a focused set of files for a one-off investigation.
        </p>

        <div className="actions-bar">
          <button
            className="btn btn-primary"
            onClick={() => onRunAnalysis()}
            disabled={loading}
            id="btn-run-analysis"
          >
            {loading ? <span className="spinner" aria-hidden="true" /> : null}
            Analyze server logs
          </button>

          <button
            className="btn btn-secondary"
            onClick={onLoadLatest}
            disabled={loading}
            id="btn-load-latest"
          >
            Load latest report
          </button>
        </div>
      </div>

      <div
        className={`upload-zone dashboard-dropzone ${dragOver ? 'drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        id="upload-zone"
      >
        <div className="upload-badge">File intake</div>
        <div className="upload-text">Drop .log or .pdf files here</div>
        <p className="upload-copy">
          Uploaded files are analyzed immediately and linked to the source document
          history so you can inspect them again later.
        </p>
        <div className="upload-hint">Up to 10 files, 10 MB each. Click to browse.</div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".log,.pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="file-input"
        />
      </div>
    </section>
  );
}
