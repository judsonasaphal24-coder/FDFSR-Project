/**
 * AudioUpload Component
 * =====================
 * Drag-and-drop audio file upload with full format support,
 * progress indicator, and deep analysis trigger.
 */
import React, { useState, useCallback, useRef } from 'react';

const ACCEPTED_FORMATS = '.mp3,.wav,.flac,.ogg,.aiff,.aac,.m4a,.wma';
const ACCEPTED_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/flac', 'audio/ogg', 'audio/aiff', 'audio/x-aiff',
  'audio/aac', 'audio/mp4', 'audio/x-m4a',
];

export default function AudioUpload({ onUpload, loading = false, error = null }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['mp3', 'wav', 'flac', 'ogg', 'aiff', 'aac', 'm4a', 'wma'];
    if (!validExts.includes(ext)) {
      alert(`Unsupported format: .${ext}\nSupported: ${validExts.join(', ')}`);
      return;
    }
    setSelectedFile(file);
    if (onUpload) onUpload(file);
  }, [onUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleClick = () => inputRef.current?.click();
  const handleInputChange = (e) => handleFile(e.target.files[0]);

  return (
    <div id="audio-upload" style={styles.container}>
      <div
        style={{
          ...styles.dropZone,
          ...(isDragOver ? styles.dropZoneActive : {}),
          ...(loading ? styles.dropZoneLoading : {}),
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>Analyzing audio...</span>
            <span style={styles.loadingSubtext}>
              Running pitch detection, key detection, chord analysis, and segmentation
            </span>
            <div style={styles.progressBar}>
              <div style={styles.progressFill} />
            </div>
          </div>
        ) : selectedFile && !error ? (
          <div style={styles.successState}>
            <span style={styles.successIcon}>✅</span>
            <span style={styles.fileName}>{selectedFile.name}</span>
            <span style={styles.fileSize}>
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <span style={styles.dropHint}>Click to upload a different file</span>
          </div>
        ) : (
          <>
            <div style={styles.iconRow}>
              <span style={styles.icon}>🎵</span>
              <span style={styles.icon}>🎸</span>
              <span style={styles.icon}>🎹</span>
            </div>
            <span style={styles.dropTitle}>
              Drop audio file here or click to browse
            </span>
            <span style={styles.dropFormats}>
              MP3 &nbsp;·&nbsp; WAV &nbsp;·&nbsp; FLAC &nbsp;·&nbsp; OGG &nbsp;·&nbsp; AIFF &nbsp;·&nbsp; AAC &nbsp;·&nbsp; M4A
            </span>
            <span style={styles.dropHint}>
              Supports files up to 100 MB — Full deep analysis included
            </span>
          </>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          <span>⚠️ {error}</span>
          <button style={styles.retryBtn} onClick={handleClick}>Try again</button>
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
    gap: 10,
    minHeight: 160,
    padding: '32px 24px',
    border: '2px dashed rgba(255,255,255,0.08)',
    borderRadius: 12,
    background: 'rgba(18, 18, 30, 0.6)',
    cursor: 'pointer',
    transition: 'all 200ms ease',
  },
  dropZoneActive: {
    borderColor: 'var(--accent-primary)',
    background: 'rgba(0, 212, 255, 0.05)',
    boxShadow: 'inset 0 0 40px rgba(0, 212, 255, 0.08)',
  },
  dropZoneLoading: {
    borderColor: 'var(--accent-purple)',
    cursor: 'wait',
  },
  iconRow: {
    display: 'flex',
    gap: 12,
    fontSize: '1.5rem',
    opacity: 0.7,
  },
  icon: { fontSize: '1.8rem' },
  dropTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  dropFormats: {
    fontSize: '0.7rem',
    color: 'var(--accent-primary)',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  dropHint: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--bg-surface)',
    borderTopColor: 'var(--accent-purple)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--accent-purple)',
  },
  loadingSubtext: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    maxWidth: 300,
  },
  progressBar: {
    width: '200px',
    height: 4,
    background: 'var(--bg-surface)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '60%',
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-primary))',
    borderRadius: 2,
    animation: 'progressPulse 2s ease-in-out infinite',
  },
  successState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  successIcon: { fontSize: '1.5rem' },
  fileName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-bright)',
  },
  fileSize: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(255, 62, 94, 0.1)',
    border: '1px solid rgba(255, 62, 94, 0.2)',
    borderRadius: 8,
    fontSize: '0.7rem',
    color: 'var(--error)',
  },
  retryBtn: {
    background: 'rgba(255, 62, 94, 0.15)',
    border: '1px solid rgba(255, 62, 94, 0.3)',
    borderRadius: 6,
    padding: '4px 10px',
    color: 'var(--error)',
    fontSize: '0.65rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
