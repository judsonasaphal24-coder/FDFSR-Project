/**
 * TransportControls Component
 * ===========================
 * Record, play, stop, and time display.
 */
import React from 'react';
import { formatTime } from '../utils/noteUtils';

export default function TransportControls({
  isRecording,
  onRecord,
  onStop,
  currentTime = 0,
  currentKey = '',
  currentChord = '',
  rms = 0,
}) {
  return (
    <div id="transport-controls" style={styles.container}>
      <div style={styles.left}>
        <span style={styles.title}>FDFSR</span>
        <span style={styles.subtitle}>Audio Intelligence Studio</span>
      </div>

      <div style={styles.center}>
        <button
          id="btn-stop"
          className="transport-btn"
          style={styles.stopBtn}
          onClick={onStop}
          title="Stop"
        >
          ■
        </button>
        <button
          id="btn-record"
          className={`transport-btn record ${isRecording ? 'active' : ''}`}
          onClick={isRecording ? onStop : onRecord}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          ●
        </button>
        <div style={styles.timeDisplay} className="mono">
          {formatTime(currentTime)}
        </div>
      </div>

      <div style={styles.right}>
        {currentKey && (
          <div style={styles.infoChip}>
            <span style={styles.infoLabel}>KEY</span>
            <span style={styles.infoValue}>{currentKey}</span>
          </div>
        )}
        {currentChord && currentChord !== 'N/C' && (
          <div style={{ ...styles.infoChip, ...styles.chordChip }}>
            <span style={styles.infoLabel}>CHORD</span>
            <span style={styles.infoValue}>{currentChord}</span>
          </div>
        )}
        <div style={styles.meterContainer}>
          <div style={styles.meterBg}>
            <div
              style={{
                ...styles.meterFill,
                width: `${Math.min(100, rms * 500)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: 'var(--transport-height)',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    gap: 16,
    zIndex: 10,
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 140,
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: 'var(--accent-primary)',
    letterSpacing: '0.1em',
  },
  subtitle: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stopBtn: {
    fontSize: '10px',
  },
  timeDisplay: {
    fontFamily: 'var(--font-mono)',
    fontSize: '1.1rem',
    color: 'var(--text-bright)',
    minWidth: 100,
    textAlign: 'center',
    letterSpacing: '0.02em',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 200,
    justifyContent: 'flex-end',
  },
  infoChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 10px',
    background: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 6,
    border: '1px solid rgba(0, 212, 255, 0.15)',
  },
  chordChip: {
    background: 'rgba(0, 255, 136, 0.08)',
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  infoLabel: {
    fontSize: '0.5rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  infoValue: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-bright)',
    fontFamily: 'var(--font-mono)',
  },
  meterContainer: {
    width: 60,
  },
  meterBg: {
    height: 4,
    background: 'var(--bg-surface)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-secondary), var(--accent-primary), var(--accent-warm))',
    borderRadius: 2,
    transition: 'width 50ms linear',
  },
};
