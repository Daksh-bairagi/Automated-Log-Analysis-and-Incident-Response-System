import React from 'react';

export default function AnalyzedFileList({ files }) {
  if (!files || files.length === 0) return null;

  const normalizedFiles = files.map((file) => {
    if (typeof file === 'string') {
      const parts = file.replace(/\\/g, '/').split('/');
      return { fullPath: file, name: parts[parts.length - 1] };
    }
    return file;
  });

  return (
    <section className="card asset-card fade-in" id="analyzed-files">
      <div className="section-header section-header--compact">
        <div>
          <div className="section-eyebrow">Inputs</div>
          <div className="section-title">Analyzed files</div>
        </div>
        <div className="section-caption">{normalizedFiles.length} source files</div>
      </div>

      <ul className="asset-list">
        {normalizedFiles.map((file, index) => (
          <li className="asset-row" key={index} title={file.fullPath || file.name}>
            <div className="asset-copy">
              <div className="asset-name">{file.name}</div>
              <div className="asset-subtle">{file.fullPath || 'Imported source'}</div>
            </div>
            {file.format ? (
              <span className="asset-pill">{String(file.format).toUpperCase()}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
