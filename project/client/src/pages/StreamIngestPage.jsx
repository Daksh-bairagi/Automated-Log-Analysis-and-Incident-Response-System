import React, { useState, useRef, useEffect } from 'react';
import useStreamIngest from '../hooks/useStreamIngest';

// ── Tiny SVG Sparkline ──────────────────────────────────────────────────────
function Sparkline({ data = [], width = 220, height = 48, color = '#6aa8ff' }) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="sparkline">
        <line x1="0" y1={height} x2={width} y2={height} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="rgba(255,255,255,.3)" fontSize="10">
          Waiting…
        </text>
      </svg>
    );
  }
  const maxEps = Math.max(...data.map((d) => d.eps), 1);
  const step   = width / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - (d.eps / maxEps) * (height - 6);
    return `${x},${y}`;
  });
  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(' ');
  const linePoints = points.join(' ');

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.36" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ── Log Terminal (inline — reuses CSS classes from global stylesheet) ────────
function InlineTerminal({ entries, autoScroll: externalAutoScroll, maxHeight = '360px' }) {
  const scrollRef  = useRef(null);   // the scrollable container
  const bottomRef  = useRef(null);   // sentinel at the very bottom
  const userScrolledUpRef = useRef(false);  // true when user has scrolled away from bottom
  const [showJumpBtn, setShowJumpBtn] = useState(false);

  // Detect when user manually scrolls up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      // "at bottom" = within 80px of the bottom edge
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledUpRef.current = !atBottom;
      setShowJumpBtn(!atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll: only jump to bottom if user hasn't scrolled up
  useEffect(() => {
    if (externalAutoScroll && !userScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, externalAutoScroll]);

  const jumpToBottom = () => {
    userScrolledUpRef.current = false;
    setShowJumpBtn(false);
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const levelClass = (lvl = '') => {
    const l = lvl.toUpperCase();
    if (['CRITICAL', 'FATAL'].includes(l)) return 'critical';
    if (['ERROR', 'ERR'].includes(l))      return 'high';
    if (['WARN', 'WARNING'].includes(l))   return 'medium';
    return 'low';
  };

  return (
    <div className="log-terminal-wrapper" style={{ position: 'relative' }}>
      <div className="terminal-header">
        <div className="terminal-title-block">
          <div className="terminal-kicker">Live output</div>
          <div className="terminal-title">Processed entries</div>
        </div>
        <span className="terminal-count">{entries.length.toLocaleString()} lines</span>
      </div>

      <div ref={scrollRef} className="log-terminal" style={{ maxHeight, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div className="terminal-empty">
            <span className="text-muted" style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
              Waiting for first event…
            </span>
          </div>
        ) : (
          entries.map((e, i) => (
            <div key={i} className={`log-entry${e.isIncident ? ' incident' : ''}`}>
              <span className="log-ts">{(e.timestamp || '').slice(11, 23)}</span>
              <span className={`log-level ${levelClass(e.level)}`}>{e.level}</span>
              <span className="log-source">{e.source}</span>
              <span className="log-msg">{e.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Jump-to-bottom button — appears when user has scrolled up */}
      {showJumpBtn && (
        <button
          onClick={jumpToBottom}
          id="si-jump-to-bottom"
          style={{
            position:     'absolute',
            bottom:       '12px',
            right:        '16px',
            background:   'var(--accent-blue, #6aa8ff)',
            color:        '#000',
            border:       'none',
            borderRadius: '20px',
            padding:      '5px 14px',
            fontSize:     '0.78rem',
            fontWeight:   600,
            cursor:       'pointer',
            boxShadow:    '0 4px 12px rgba(0,0,0,.4)',
            zIndex:        10,
            display:      'flex',
            alignItems:   'center',
            gap:          '5px',
          }}
        >
          ↓ Jump to bottom
        </button>
      )}
    </div>
  );
}

// ── Header Key-Value Editor (custom HTTP headers) ──────────────────────────
function HeaderEditor({ headers, onChange }) {
  const add    = () => onChange([...headers, { key: '', value: '' }]);
  const remove = (i) => onChange(headers.filter((_, idx) => idx !== i));
  const update = (i, field, val) =>
    onChange(headers.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)));

  return (
    <div className="si-header-editor">
      {headers.map((h, i) => (
        <div key={i} className="si-header-row">
          <input
            className="si-header-input"
            placeholder="Header name"
            value={h.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            id={`si-header-key-${i}`}
          />
          <span className="si-header-sep">:</span>
          <input
            className="si-header-input"
            placeholder="Value"
            value={h.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            id={`si-header-val-${i}`}
          />
          <button className="si-header-remove" onClick={() => remove(i)} title="Remove header">✕</button>
        </div>
      ))}
      <button className="si-add-header-btn" onClick={add} id="si-add-header-btn">+ Add header</button>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function StreamIngestPage() {
  const { status, entries, incidents, metrics, error, start, stop, clear, exportCSV } = useStreamIngest();

  // Config state
  const [mode,       setMode]       = useState('demo');  // 'demo' | 'url'
  const [url,        setUrl]        = useState('');
  const [format,     setFormat]     = useState('auto');
  const [demoCount,  setDemoCount]  = useState(500);
  const [demoDelay,  setDemoDelay]  = useState(30);
  const [customHdrs, setCustomHdrs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab,  setActiveTab]  = useState('terminal'); // 'terminal' | 'incidents'

  const isRunning = status === 'connecting' || status === 'streaming' || status === 'saving';

  function handleStart() {
    if (mode === 'demo') {
      start({ url: 'demo', count: demoCount, delay: demoDelay });
    } else {
      start({ url, format });
    }
  }

  // Severity dot colour
  const sevColor = { CRITICAL: '#ff7a6f', HIGH: '#ff9b4d', MEDIUM: '#f2cb5f', LOW: '#54d6b8' };

  const fmtMs = (ms) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="page-shell fade-in" id="stream-ingest-page">

      {/* ── Hero ── */}
      <section className="hero-panel si-hero">
        <div>
          <div className="section-eyebrow">Stream Ingest</div>
          <h1 className="page-title">Ingest &amp; analyse any data stream.</h1>
          <p className="page-description">
            Point the ingestion engine at any HTTP endpoint that emits line-delimited data.
            Every chunk flows through the local parser &amp; severity classifier in real time.
          </p>
        </div>
        <div className="si-hero-stats">
          <div className="si-mini-kpi">
            <span className="si-mini-val">{metrics.totalEntries.toLocaleString()}</span>
            <span className="si-mini-lbl">Total entries</span>
          </div>
          <div className="si-mini-kpi">
            <span className="si-mini-val" style={{ color: '#ff7a6f' }}>{metrics.totalIncidents.toLocaleString()}</span>
            <span className="si-mini-lbl">Incidents</span>
          </div>
          <div className="si-mini-kpi">
            <span className="si-mini-val" style={{ color: '#6aa8ff' }}>{metrics.eps.toLocaleString()}</span>
            <span className="si-mini-lbl">Entries / sec</span>
          </div>
          <div className="si-mini-kpi">
            <span className="si-mini-val">{fmtMs(metrics.elapsedMs)}</span>
            <span className="si-mini-lbl">Elapsed</span>
          </div>
        </div>
      </section>

      {/* ── Config Panel ── */}
      <section className="card si-config-panel" id="si-config">
        <div className="section-header">
          <div>
            <div className="section-eyebrow">Configuration</div>
            <div className="section-title">Stream source &amp; options</div>
          </div>
          <div className="si-mode-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'demo'}
              className={`si-mode-tab ${mode === 'demo' ? 'active' : ''}`}
              onClick={() => setMode('demo')}
              id="si-mode-demo-tab"
            >⚡ Demo</button>
            <button
              role="tab"
              aria-selected={mode === 'url'}
              className={`si-mode-tab ${mode === 'url' ? 'active' : ''}`}
              onClick={() => setMode('url')}
              id="si-mode-url-tab"
            >🌐 External URL</button>
          </div>
        </div>

        {mode === 'demo' ? (
          <div className="si-config-fields">
            <div className="si-field">
              <label className="si-label" htmlFor="si-demo-count">Entry count</label>
              <input
                id="si-demo-count"
                className="si-input"
                type="number"
                min={10}
                max={5000}
                value={demoCount}
                onChange={(e) => setDemoCount(Number(e.target.value))}
              />
              <span className="si-hint">Max 5 000</span>
            </div>
            <div className="si-field">
              <label className="si-label" htmlFor="si-demo-delay">Delay between entries (ms)</label>
              <input
                id="si-demo-delay"
                className="si-input"
                type="number"
                min={5}
                max={2000}
                value={demoDelay}
                onChange={(e) => setDemoDelay(Number(e.target.value))}
              />
              <span className="si-hint">Min 5 ms</span>
            </div>
          </div>
        ) : (
          <div className="si-config-fields">
            <div className="si-field si-field--wide">
              <label className="si-label" htmlFor="si-url-input">Streaming endpoint URL</label>
              <input
                id="si-url-input"
                className="si-input"
                type="url"
                placeholder="https://example.com/api/logstream"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="si-field">
              <label className="si-label" htmlFor="si-format-select">Format</label>
              <select
                id="si-format-select"
                className="si-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="auto">Auto-detect</option>
                <option value="json">NDJSON</option>
                <option value="generic">Plain text</option>
                <option value="syslog">Syslog</option>
                <option value="apache">Apache/Nginx</option>
              </select>
            </div>
            <div className="si-field si-field--wide">
              <label className="si-label">Custom request headers</label>
              <HeaderEditor headers={customHdrs} onChange={setCustomHdrs} />
            </div>
          </div>
        )}

        {/* Action buttons — Start + Stop always visible */}
        <div className="si-actions">
          {/* START */}
          <button
            id="si-start-btn"
            className="btn btn-primary si-start-btn"
            onClick={handleStart}
            disabled={isRunning || (mode === 'url' && !url.trim())}
            title="Start ingesting the stream"
          >
            <span className="si-pulse-dot" />
            Start stream
          </button>

          {/* STOP STREAM — always visible, prominent red */}
          <button
            id="si-stop-btn"
            onClick={stop}
            disabled={!isRunning || status === 'saving'}
            title="Stop the stream and save all session data to MongoDB"
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             '7px',
              padding:         '0 22px',
              height:          '42px',
              borderRadius:    '8px',
              fontWeight:      700,
              fontSize:        '0.95rem',
              border:          'none',
              cursor:          isRunning && status !== 'saving' ? 'pointer' : 'not-allowed',
              background:      isRunning && status !== 'saving'
                                 ? 'linear-gradient(135deg,#e53935,#b71c1c)'
                                 : 'rgba(255,255,255,0.06)',
              color:           isRunning && status !== 'saving' ? '#fff' : 'rgba(255,255,255,0.3)',
              boxShadow:       isRunning && status !== 'saving'
                                 ? '0 0 18px rgba(229,57,53,0.45)'
                                 : 'none',
              transition:      'all 0.25s ease',
            }}
          >
            {/* Animated square icon */}
            <span style={{
              width:        '13px',
              height:       '13px',
              borderRadius: '3px',
              background:   isRunning && status !== 'saving' ? '#fff' : 'rgba(255,255,255,0.3)',
              flexShrink:   0,
              animation:    isRunning && status !== 'saving' ? 'si-stop-pulse 1.4s ease infinite' : 'none',
            }} />
            Stop stream &amp; save
          </button>
          <button
            id="si-clear-btn"
            className="btn btn-secondary"
            onClick={clear}
            disabled={isRunning}
          >
            Clear
          </button>
          <button
            id="si-export-btn"
            className="btn btn-secondary"
            onClick={exportCSV}
            disabled={entries.length === 0}
          >
            ↓ Export CSV
          </button>
          <label className="si-autoscroll-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              id="si-autoscroll-check"
            />
            Auto-scroll
          </label>

          {/* Status chip */}
          <span
            className={`status-chip ${
              status === 'streaming'  ? 'is-live'    :
              status === 'connecting' ? 'is-paused'  :
              status === 'saving'     ? 'is-paused'  :
              status === 'done'       ? 'si-done'    :
              status === 'error'      ? 'is-offline' :
              'is-offline'
            }`}
          >
            {status === 'streaming'  ? '🔴 Streaming'       :
             status === 'connecting' ? 'Connecting'         :
             status === 'saving'     ? '💾 Saving to DB…'   :
             status === 'done'       ? 'Done ✓'             :
             status === 'error'      ? 'Error'              :
             'Idle'}
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="feedback-banner feedback-banner--error si-error" id="si-error-banner">
            <strong>Stream error:</strong> {error}
          </div>
        )}

        {/* Done summary */}
        {status === 'done' && (
          <div className="feedback-banner feedback-banner--success" id="si-done-banner">
            <strong>Completed ✓ — saved to MongoDB.</strong>{' '}
            {metrics.totalEntries.toLocaleString()} entries processed, {metrics.totalIncidents.toLocaleString()} incidents detected in {fmtMs(metrics.elapsedMs)}.
          </div>
        )}
        {status === 'saving' && (
          <div className="feedback-banner" style={{ background: 'rgba(106,168,255,0.12)', borderColor: 'rgba(106,168,255,0.3)', color: 'var(--accent-blue, #6aa8ff)' }} id="si-saving-banner">
            <strong>💾 Saving session to MongoDB…</strong> please wait a moment.
          </div>
        )}
      </section>

      {/* ── Metrics Bar ── */}
      <section className="si-metrics-bar" id="si-metrics-bar">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <article className="card si-sev-card" key={sev}>
            <div className="si-sev-dot" style={{ background: sevColor[sev] }} />
            <div className="si-sev-body">
              <div className="si-sev-label">{sev}</div>
              <div className="si-sev-count">{(metrics.severityBreakdown[sev] || 0).toLocaleString()}</div>
            </div>
          </article>
        ))}
        <article className="card si-sparkline-card">
          <div className="si-sev-label" style={{ marginBottom: 8 }}>Entries / sec</div>
          <Sparkline data={metrics.epsHistory} width={204} height={44} />
          <div className="si-spark-current">{metrics.eps} eps</div>
        </article>
      </section>

      {/* ── Main content area ── */}
      <div className="si-main-layout">

        {/* Left: Terminal + Tabs */}
        <section className="si-left-panel">
          <div className="si-tabs" role="tablist">
            <button
              role="tab"
              className={`si-tab ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
              id="si-tab-terminal"
            >
              Terminal
            </button>
            <button
              role="tab"
              className={`si-tab ${activeTab === 'incidents' ? 'active' : ''}`}
              onClick={() => setActiveTab('incidents')}
              id="si-tab-incidents"
            >
              Incidents <span className="si-tab-badge">{incidents.length}</span>
            </button>
          </div>

          {activeTab === 'terminal' && (
            <InlineTerminal entries={entries} autoScroll={autoScroll} maxHeight="520px" />
          )}

          {activeTab === 'incidents' && (
            <div className="card si-incidents-list" id="si-incidents-list">
              {incidents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">No incidents detected</div>
                  <div className="empty-text">Incidents will appear here as the stream is classified.</div>
                </div>
              ) : (
                incidents.map((inc, i) => (
                  <article
                    key={inc.id || i}
                    className={`live-incident-item severity-${(inc.severity || 'low').toLowerCase()}`}
                  >
                    <div className="incident-item-head">
                      <span className={`badge badge-${(inc.severity || 'low').toLowerCase()}`}>{inc.severity}</span>
                      <span className="incident-id">{inc.id}</span>
                    </div>
                    <div className="incident-item-body">{inc.message}</div>
                    <div className="incident-item-source">{inc.source} · {(inc.timestamp || '').slice(11, 23)}</div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>

        {/* Right: Summary sidebar */}
        <aside className="card si-sidebar" id="si-sidebar">
          <div className="section-eyebrow">Session summary</div>
          <div className="section-title" style={{ marginBottom: 20 }}>Stats</div>

          <dl className="si-summary-dl">
            <dt>Status</dt>
            <dd style={{ textTransform: 'capitalize', color: status === 'streaming' ? 'var(--accent-teal)' : 'var(--text-soft)' }}>
              {status}
            </dd>

            <dt>Total entries</dt>
            <dd>{metrics.totalEntries.toLocaleString()}</dd>

            <dt>Incidents detected</dt>
            <dd style={{ color: metrics.totalIncidents > 0 ? 'var(--severity-critical)' : 'inherit' }}>
              {metrics.totalIncidents.toLocaleString()}
            </dd>

            <dt>Current EPS</dt>
            <dd>{metrics.eps.toLocaleString()}</dd>

            <dt>Elapsed</dt>
            <dd>{fmtMs(metrics.elapsedMs)}</dd>

            <dt>Buffered in memory</dt>
            <dd>{entries.length.toLocaleString()} / 2 000</dd>
          </dl>

          <div className="si-sev-breakdown" style={{ marginTop: 20 }}>
            <div className="section-eyebrow" style={{ marginBottom: 12 }}>Severity breakdown</div>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
              const count = metrics.severityBreakdown[sev] || 0;
              const pct   = metrics.totalEntries > 0 ? (count / metrics.totalEntries) * 100 : 0;
              return (
                <div className="severity-row" key={sev}>
                  <div className="severity-row-head">
                    <span className="severity-row-label">{sev}</span>
                    <span className="severity-row-meta">{count.toLocaleString()}</span>
                  </div>
                  <div className="severity-bar-track">
                    <div
                      className={`severity-bar-fill ${sev.toLowerCase()}`}
                      style={{ width: `${pct}%`, transition: 'width 400ms ease' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-secondary"
            style={{ marginTop: 24, width: '100%' }}
            onClick={exportCSV}
            disabled={entries.length === 0}
            id="si-sidebar-export-btn"
          >
            ↓ Download CSV
          </button>
        </aside>
      </div>
    </div>
  );
}
