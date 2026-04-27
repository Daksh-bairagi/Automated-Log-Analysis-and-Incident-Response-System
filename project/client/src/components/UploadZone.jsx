import React from 'react';
import useFileUpload from '../hooks/useFileUpload';
import LoadingSpinner from './LoadingSpinner';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ onResult }) {
  const {
    files,
    isDragging,
    uploadProgress,
    isUploading,
    result,
    error,
    inputRef,
    removeFile,
    clearFiles,
    upload,
    openFilePicker,
    onInputChange,
    dragHandlers,
    acceptedTypes,
    maxFiles,
  } = useFileUpload();

  React.useEffect(() => {
    if (result && onResult) {
      onResult(result);
    }
  }, [result, onResult]);

  const resultSummary = result?.view?.summary || {};
  const resultUploads = result?.storedUploads || result?.uploads || [];

  return (
    <section className="card upload-panel fade-in" id="upload-zone">
      <div
        className={`upload-drop-area ${isDragging ? 'is-dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
        {...dragHandlers}
        onClick={files.length === 0 ? openFilePicker : undefined}
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
      >
        <div className="upload-drop-icon" aria-hidden="true">
          {isDragging ? 'Drop' : 'Files'}
        </div>
        <div className="upload-drop-copy">
          <div className="upload-drop-title">
            {isDragging ? 'Release files to add them' : 'Add log evidence for analysis'}
          </div>
          <p className="upload-drop-text">
            Drop `.log` or `.pdf` files here, or{' '}
            <button
              type="button"
              className="link-button"
              onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}
            >
              browse from disk
            </button>
            .
          </p>
          <p className="upload-drop-hint">
            Up to {maxFiles} files, 10 MB each. Accepted types: {acceptedTypes}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={onInputChange}
        style={{ display: 'none' }}
        id="file-input"
        aria-hidden="true"
      />

      {error ? (
        <div className="feedback-banner feedback-banner--error" role="alert" id="upload-error">
          <strong>Upload issue.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="selected-files" id="file-list">
          <div className="selected-files-header">
            <div>
              <div className="section-eyebrow">Current batch</div>
              <div className="section-title">Selected files</div>
            </div>
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={clearFiles}
              id="clear-files-btn"
            >
              Clear list
            </button>
          </div>

          <div className="selected-files-list">
            {files.map((file, index) => (
              <div className="file-token" key={`${file.name}-${index}`}>
                <span className="file-token-type">
                  {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'LOG'}
                </span>
                <div className="file-token-copy">
                  <div className="file-token-name">{file.name}</div>
                  <div className="file-token-meta">{formatSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  id={`remove-file-${index}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {!isUploading ? (
            <button
              type="button"
              onClick={upload}
              className="btn btn-primary upload-primary-action"
              id="upload-submit-btn"
            >
              Analyze {files.length} file{files.length === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
      ) : null}

      {isUploading ? (
        <div className="upload-progress" id="upload-progress">
          <div className="upload-progress-head">
            <div className="upload-progress-label">
              <LoadingSpinner size="sm" inline />
              <span>Uploading and analyzing files</span>
            </div>
            <span>{uploadProgress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : null}

      {result && !isUploading ? (
        <div className="upload-success" id="upload-result">
          <div className="selected-files-header">
            <div>
              <div className="section-eyebrow">Completed run</div>
              <div className="section-title">Analysis saved successfully</div>
            </div>
            <span className="asset-pill">{resultUploads.length || files.length} file(s)</span>
          </div>

          <div className="mini-stat-grid">
            <div className="mini-stat">
              <span className="mini-stat-label">Entries processed</span>
              <strong>{(resultSummary.totalEntries ?? result?.report?.processedEntries ?? 0).toLocaleString()}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-label">Incidents detected</span>
              <strong>{(result?.incidents?.length ?? 0).toLocaleString()}</strong>
            </div>
            <div className="mini-stat">
              <span className="mini-stat-label">Parse errors</span>
              <strong>{(resultSummary.parseErrors ?? result?.report?.parseErrors ?? 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
