/**
 * ============================================================================
 * INCIDENT API SERVICE — Backend API Methods
 * ============================================================================
 * Provides typed methods for each backend API endpoint. Components and hooks
 * call these methods instead of using the raw Axios client directly.
 *
 * METHODS:
 *   healthCheck()           → GET  /api/health
 *   runAnalysis(options)    → POST /api/analyze
 *   uploadAndAnalyze(files) → POST /api/upload
 *   getLatestReport()       → GET  /api/report/latest
 *   listUploads()           → GET  /api/uploads
 *
 * USAGE:
 *   import { runAnalysis, getLatestReport } from './incidentApi';
 *   const result = await runAnalysis({ logDir: './logs' });
 * ============================================================================
 */

import apiClient, { API_BASE_URL } from './apiClient';

/**
 * Checks the backend server health status.
 *
 * @returns {Promise<Object>} Health status with uptime and default file count
 */
export async function healthCheck() {
  return apiClient.get('/api/health');
}

/**
 * Runs analysis on server-side log files.
 *
 * @param {Object} options - Analysis options
 * @param {string} [options.logDir] - Custom log directory to scan
 * @param {string[]} [options.logFiles] - Specific file paths to analyze
 * @returns {Promise<Object>} Analysis result with report, view, incidents
 */
export async function runAnalysis(options = {}) {
  return apiClient.post('/api/analyze', options);
}

/**
 * Uploads files and runs analysis on their contents.
 * Sends files as multipart/form-data.
 *
 * @param {File[]} files - Browser File objects from input or drag-drop
 * @returns {Promise<Object>} Analysis result with upload metadata
 */
export async function uploadAndAnalyze(files) {
  // Build a FormData object for multipart upload
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  return apiClient.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data', },
    timeout: 60000,  // Extended timeout for file uploads
  });
}

/**
 * Retrieves the most recent analysis report from the server.
 *
 * @returns {Promise<Object>} Latest report with dashboard view
 */
export async function getLatestReport() {
  return apiClient.get('/api/reports/latest');
}

/**
 * Lists all stored uploaded source documents.
 *
 * @returns {Promise<Object>} List of uploaded document metadata
 */
export async function listUploads() {
  return apiClient.get('/api/upload/list');
}

function parseDownloadFilename(contentDisposition, fallback) {
  const match = String(contentDisposition || '').match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export async function downloadLatestReport(format = 'csv') {
  const normalizedFormat = String(format || 'csv').toLowerCase();
  const token = localStorage.getItem('log_analyzer_token');
  const response = await fetch(
    `${API_BASE_URL}/api/reports/latest/export?format=${encodeURIComponent(normalizedFormat)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    let message = `Failed to export ${normalizedFormat.toUpperCase()} report.`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // Ignore JSON parse failures for non-JSON error bodies.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = parseDownloadFilename(
    response.headers.get('content-disposition'),
    `report-latest.${normalizedFormat}`
  );
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);

  return { filename };
}
