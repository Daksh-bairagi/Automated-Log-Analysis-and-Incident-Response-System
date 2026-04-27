import React, { useEffect, useRef, useState } from 'react';

function getSeverityClass(entry) {
  const level = (entry.level || entry.severity || '').toUpperCase();
  if (level === 'CRITICAL') return 'critical';
  if (level === 'ERROR' || level === 'HIGH') return 'high';
  if (level === 'WARN' || level === 'WARNING' || level === 'MEDIUM') return 'medium';
  return 'low';
}

function formatTimestamp(value) {
  if (!value) return '--:--:--';

  try {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--:--';
  }
}

export default function LogTerminal({
  entries = [],
  autoScroll = true,
  maxHeight = '600px',
}) {
  const terminalRef = useRef(null);
  const bottomRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);

  useEffect(() => {
    if (autoScroll && !isUserScrolled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [entries.length, autoScroll, isUserScrolled]);

  const handleScroll = () => {
    if (!terminalRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsUserScrolled(!isAtBottom);
  };

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setIsUserScrolled(false);
  };

  return (
    <div className="log-terminal-wrapper" id="log-terminal-wrapper">
      <div className="terminal-header">
        <div className="terminal-title-block">
          <div className="terminal-kicker">Realtime feed</div>
          <div className="terminal-title">Event stream</div>
        </div>
        <div className="terminal-count">{entries.length.toLocaleString()} entries</div>
      </div>

      <div
        className="log-terminal"
        ref={terminalRef}
        onScroll={handleScroll}
        style={{ maxHeight }}
        id="log-terminal"
      >
        {entries.length === 0 ? (
          <div className="terminal-empty">
            <div className="terminal-empty-title">Waiting for stream data</div>
            <div className="terminal-empty-copy">
              New log lines will appear here as soon as the watcher emits them.
            </div>
          </div>
        ) : (
          entries.map((entry, index) => {
            const severityClass = getSeverityClass(entry);
            const incidentLike =
              ['CRITICAL', 'HIGH'].includes((entry.severity || '').toUpperCase()) ||
              ['CRITICAL', 'ERROR'].includes((entry.level || '').toUpperCase());

            return (
              <div
                key={entry._id || `${entry.timestamp || 'ts'}-${index}`}
                className={`log-entry ${severityClass} ${incidentLike ? 'incident' : ''}`}
              >
                <span className="log-ts">{formatTimestamp(entry.timestamp)}</span>
                <span className={`log-level ${severityClass}`}>
                  {(entry.level || entry.severity || 'INFO').toUpperCase()}
                </span>
                <span className="log-source">{entry.source || entry.file || 'unknown'}</span>
                <span className="log-msg">{entry.message || 'No message captured.'}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isUserScrolled && entries.length > 0 ? (
        <button
          className="btn btn-secondary jump-to-bottom"
          onClick={jumpToBottom}
          id="jump-to-bottom-btn"
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
