/**
 * useFileUpload — Drag-and-Drop File Upload Hook
 * Manages upload state, file validation, progress tracking, and results.
 */
import { useState, useCallback, useRef } from 'react';
import uploadApi from '../services/uploadApi';

const ACCEPTED_TYPES = ['.log', '.pdf'];
const MAX_FILES = 10;
const MAX_SIZE_MB = 10;

export default function useFileUpload() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const validateFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      return `"${file.name}" is not a supported file type (${ACCEPTED_TYPES.join(', ')})`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `"${file.name}" exceeds the ${MAX_SIZE_MB}MB limit`;
    }
    return null;
  };

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming);
    const errors = [];
    const valid = [];

    for (const f of list) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }

    if (errors.length) setError(errors.join('\n'));
    else setError(null);

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, MAX_FILES);
    });
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  // Drag events
  const onDragEnter = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const openFilePicker = useCallback(() => inputRef.current?.click(), []);

  const onInputChange = useCallback((e) => {
    addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const upload = useCallback(async () => {
    if (!files.length) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setResult(null);
    try {
      const data = await uploadApi.uploadFiles(files, setUploadProgress);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [files]);

  return {
    files,
    isDragging,
    uploadProgress,
    isUploading,
    result,
    error,
    inputRef,
    addFiles,
    removeFile,
    clearFiles,
    upload,
    openFilePicker,
    onInputChange,
    dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
    acceptedTypes: ACCEPTED_TYPES.join(','),
    maxFiles: MAX_FILES,
  };
}
