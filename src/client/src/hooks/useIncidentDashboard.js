/**
 * ============================================================================
 * useIncidentDashboard — Central Dashboard State Hook
 * ============================================================================
 * Custom React hook that manages all state and side effects for the
 * Incident Dashboard feature. Encapsulates:
 *   - Analysis result state (report, view, incidents)
 *   - Loading and error states
 *   - Filter state (severity, search)
 *   - Selected incident for detail view
 *   - API interaction methods
 *
 * PATTERN: This hook acts as a "view model" — the dashboard component
 * is purely presentational and delegates all logic here.
 *
 * USAGE:
 *   const dashboard = useIncidentDashboard();
 *   <SummaryCards summary={dashboard.summary} />
 *   <button onClick={dashboard.handleRunAnalysis}>Run</button>
 * ============================================================================
 */

import { useState, useCallback } from 'react';
import { runAnalysis, uploadAndAnalyze, getLatestReport, listUploads } from '../services/incidentApi';

export default function useIncidentDashboard() {
  // ---- Core Data State ----
  const [report, setReport] = useState(null);          // Raw report object
  const [view, setView] = useState(null);              // Dashboard view model
  const [incidents, setIncidents] = useState([]);      // Incident records
  const [logFiles, setLogFiles] = useState([]);        // Analyzed file paths
  const [uploads, setUploads] = useState([]);          // Stored upload metadata

  // ---- UI State ----
  const [loading, setLoading] = useState(false);       // Loading indicator
  const [error, setError] = useState(null);            // Error message
  const [selectedIncident, setSelectedIncident] = useState(null); // Detail view

  // ---- Filter State ----
  const [severityFilter, setSeverityFilter] = useState('ALL'); // ALL|HIGH|MEDIUM|LOW
  const [searchQuery, setSearchQuery] = useState('');          // Text search

  /**
   * Runs analysis on server-side log files (default logs directory).
   */
  const handleRunAnalysis = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    setSelectedIncident(null);

    try {
      const result = await runAnalysis(options);
      setReport(result.report);
      setView(result.view);
      setIncidents(result.incidents || []);
      setLogFiles(result.logFiles || []);
      const uploadResult = await listUploads();
      setUploads(uploadResult.uploads || []);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Uploads files and runs analysis on them.
   *
   * @param {File[]} files - Browser File objects
   */
  const handleUploadAnalysis = useCallback(async (files) => {
    setLoading(true);
    setError(null);
    setSelectedIncident(null);

    try {
      const result = await uploadAndAnalyze(files);
      setReport(result.report);
      setView(result.view);
      setIncidents(result.incidents || []);
      setLogFiles(result.logFiles || []);
      setUploads(result.storedUploads || result.uploads || []);
    } catch (err) {
      setError(err.message || 'Upload analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads the most recent saved report from the server.
   */
  const handleLoadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getLatestReport();
      setReport(result.report);
      setView(result.view);
      setIncidents(result.report?.incidents || []);
      setLogFiles(result.report?.logFiles || []);
      const uploadResult = await listUploads();
      setUploads(uploadResult.uploads || []);
    } catch (err) {
      setError(err.message || 'Failed to load latest report');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Returns incidents filtered by current severity filter and search query.
   */
  const filteredIncidents = incidents.filter((inc) => {
    // Apply severity filter
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) {
      return false;
    }
    // Apply text search across id, source, and message
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (inc.id || '').toLowerCase().includes(query) ||
        (inc.source || '').toLowerCase().includes(query) ||
        (inc.message || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  // ---- Computed summary for SummaryCards ----
  const summary = view?.summary || {
    totalEntries: 0,
    totalIncidents: 0,
    parseErrors: 0,
    generatedAt: null,
    severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    incidentRate: '0.00%',
  };

  return {
    // Data
    report,
    view,
    incidents: filteredIncidents,
    allIncidents: incidents,
    logFiles,
    uploads,
    summary,

    // UI state
    loading,
    error,
    selectedIncident,
    setSelectedIncident,

    // Filters
    severityFilter,
    setSeverityFilter,
    searchQuery,
    setSearchQuery,

    // Actions
    handleRunAnalysis,
    handleUploadAnalysis,
    handleLoadLatest,
  };
}
