/**
 * MidiUpload Component
 * ====================
 * Drag-and-drop MIDI file upload with progress indicator.
 */
import React, { useState, useCallback, useRef } from 'react';
import * as api from '../services/api';

export default function MidiUpload({ onAnalysisComplete }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(mid|midi)$/i)) {
      setError('Please upload a .mid or .midi file');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress('Uploading MIDI file...');

    try {
      setProgress('Analyzing with R / Python...');
      const result = await api.uploadMidi(file, file.name);
      setResult(result);
      setProgress('Analysis complete!');
      if (onAnalysisComplete) onAnalysisComplete(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }, [onAnalysisComplete]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  return (
    <div id="midi-upload" style={styles.container}>
      <div className="label" style={{ padding: '0 4px 4px' }}>MIDI FILE IMPORT</div>

      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        style={styles.dropZone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {uploading ? (
          <div style={styles.uploadingState}>
            <div style={styles.spinner} />
            <span style={styles.progressText}>{progress}</span>
          </div>
        ) : (
          <>
            <span style={styles.icon}>🎹</span>
            <span style={styles.dropText}>
              Drop MIDI file here or click to browse
            </span>
            <span style={styles.dropHint}>.mid, .midi files supported</span>
          </>
        )}
      </div>

      {error && (
        <div style={styles.error}>⚠️ {error}</div>
      )}

      {result && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            <span style={styles.resultIcon}>✅</span>
            <span style={styles.resultName}>{result.name}</span>
          </div>
          <div style={styles.resultStats}>
            <span>Key: <strong>{result.analysis?.key?.key || '--'}</strong></span>
            <span>Notes: <strong>{result.analysis?.num_notes || 0}</strong></span>
            <span>Tempo: <strong>{result.analysis?.tempo_bpm || '--'} BPM</strong></span>
            <span>Source: <strong style={{ color: 'var(--accent-purple)' }}>
              {result.analysis?.source === 'r' ? 'R Language' : 'Python'}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 120,
    padding: '24px 16px',
  },
  icon: {
    fontSize: '2rem',
  },
  dropText: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  dropHint: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
  },
  uploadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid var(--bg-surface)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  progressText: {
    fontSize: '0.75rem',
    color: 'var(--accent-primary)',
    fontWeight: 500,
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(255, 62, 94, 0.1)',
    border: '1px solid rgba(255, 62, 94, 0.2)',
    borderRadius: 6,
    fontSize: '0.7rem',
    color: 'var(--error)',
  },
  resultCard: {
    padding: 12,
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    border: '1px solid rgba(0, 255, 136, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  resultIcon: {
    fontSize: '1rem',
  },
  resultName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-bright)',
  },
  resultStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 16px',
    fontSize: '0.65rem',
    color: 'var(--text-secondary)',
  },
};
