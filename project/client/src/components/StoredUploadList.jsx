import React from 'react';

function formatSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function StoredUploadList({ uploads }) {
  if (!uploads || uploads.length === 0) return null;

  return (
    <section className="card asset-card fade-in" id="stored-uploads">
      <div className="section-header section-header--compact">
        <div>
          <div className="section-eyebrow">Archive</div>
          <div className="section-title">Previous uploads</div>
        </div>
        <div className="section-caption">{uploads.length} stored documents</div>
      </div>

      <ul className="asset-list">
        {uploads.map((upload, index) => {
          const metaParts = [
            formatSize(upload.fileSizeBytes),
            upload.extractedLines ? `${upload.extractedLines} lines` : null,
            formatDate(upload.uploadedAt),
          ].filter(Boolean);

          return (
            <li className="asset-row" key={upload._id || index}>
              <div className="asset-copy">
                <div className="asset-name">{upload.originalName || 'Unknown file'}</div>
                <div className="asset-subtle">
                  {metaParts.length > 0 ? metaParts.join(' / ') : 'Persisted source document'}
                </div>
              </div>
              {upload.detectedFormat ? (
                <span className="asset-pill">
                  {String(upload.detectedFormat).toUpperCase()}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
