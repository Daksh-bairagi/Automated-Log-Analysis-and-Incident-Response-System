import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function UploadDetailsPage() {
  const { uploadId } = useParams();

  return (
    <div className="page-shell fade-in" id="upload-details-page">
      <section className="hero-panel page-hero">
        <div>
          <div className="section-eyebrow">Source document</div>
          <h1 className="page-title">Upload details</h1>
          <p className="page-description">
            This route is reserved for document-level history once the upload detail
            experience is fully expanded.
          </p>
        </div>
        <Link to="/" className="btn btn-secondary">
          Back to dashboard
        </Link>
      </section>

      <section className="card detail-panel">
        <div className="detail-block">
          <div className="field-label">Upload ID</div>
          <div className="field-value field-value--mono">{uploadId}</div>
        </div>

        <div className="empty-state">
          <div className="empty-icon">Details coming next</div>
          <div className="empty-text">
            The document is persisted, but the dedicated detail screen still needs the
            richer Mongo-backed view model wired into this route.
          </div>
        </div>
      </section>
    </div>
  );
}
