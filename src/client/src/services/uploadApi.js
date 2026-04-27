/**
 * Upload API — HTTP calls for file upload endpoints
 */
import apiClient from './apiClient';

const uploadApi = {
  /**
   * Upload one or more log/PDF files for analysis.
   * @param {FileList|File[]} files
   * @param {Function} [onProgress] - Progress callback (0-100)
   * @returns {Promise<Object>} Analysis result
   */
  async uploadFiles(files, onProgress) {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await apiClient.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (evt) => {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            onProgress(pct);
          }
        : undefined,
    });
    return response;
  },
};

export default uploadApi;
