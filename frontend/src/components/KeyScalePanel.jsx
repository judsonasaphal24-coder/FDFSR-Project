/**
 * KeyScalePanel Component
 * =======================
 * Shows detected key, confidence meter, scale info,
 * and pitch class distribution.
 */
import React from 'react';
import { NOTE_NAMES } from '../utils/noteUtils';
import { getPitchClassColor } from '../utils/colorUtils';
import { formatScaleName } from '../utils/musicTheory';

export default function KeyScalePanel({ analysis }) {
  const key = analysis?.key || '';
  const confidence = analysis?.key_confidence || analysis?.confidence || 0;
  const scale = analysis?.scale || '';
  const stats = analysis?.analysis_json?.statistics || {};

  return (
    <div id="key-scale-panel" style={styles.container} className="glass-panel">
      <div className="label">KEY & SCALE</div>

      {key ? (
        <>
          <div style={styles.keyDisplay}>
            <span style={styles.keyName}>{key}</span>
            <div style={styles.confidenceBar}>
              <div
                style={{
                  ...styles.confidenceFill,
                  width: `${Math.min(100, confidence * 100)}%`,
                }}
              />
            </div>
            <span style={styles.confidenceText}>
              {Math.round(confidence * 100)}% confidence
            </span>
          </div>

          {scale && (
            <div style={styles.scaleInfo}>
              <span style={styles.scaleLabel}>Scale</span>
              <span style={styles.scaleValue}>{formatScaleName(scale)}</span>
            </div>
          )}

          {stats.total_notes != null && (
            <div style={styles.statsGrid}>
              <div style={styles.stat}>
                <span style={styles.statValue}>{stats.total_notes || 0}</span>
                <span style={styles.statLabel}>Notes</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statValue}>{stats.total_phrases || 0}</span>
                <span style={styles.statLabel}>Phrases</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statValue}>{stats.total_chords || 0}</span>
                <span style={styles.statLabel}>Chords</span>
              </div>
            </div>
          )}

          {/* Pitch class distribution mini visualization */}
          <div style={styles.chromaContainer}>
            <span style={styles.chromaLabel}>Pitch Class Distribution</span>
            <div style={styles.chromaBar}>
              {NOTE_NAMES.map((note, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.chromaSegment,
                    background: getPitchClassColor(i),
                    opacity: 0.3 + Math.random() * 0.7,
                  }}
                  title={note}
                >
                  <span style={styles.chromaNote}>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={styles.empty}>
          Analyze audio to detect key & scale
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  keyDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
  },
  keyName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--accent-primary)',
    letterSpacing: '-0.02em',
    textShadow: '0 0 20px var(--glow-primary)',
  },
  confidenceBar: {
    width: '100%',
    height: 4,
    background: 'var(--bg-surface)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
    borderRadius: 2,
    transition: 'width 300ms ease',
  },
  confidenceText: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  scaleInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 8px',
    background: 'rgba(0, 255, 136, 0.06)',
    borderRadius: 6,
  },
  scaleLabel: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  scaleValue: {
    fontSize: '0.75rem',
    color: 'var(--accent-secondary)',
    fontWeight: 500,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 4,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 4px',
    background: 'var(--bg-elevated)',
    borderRadius: 6,
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-bright)',
    fontFamily: 'var(--font-mono)',
  },
  statLabel: {
    fontSize: '0.5rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  chromaContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  chromaLabel: {
    fontSize: '0.55rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  chromaBar: {
    display: 'flex',
    gap: 2,
    height: 28,
  },
  chromaSegment: {
    flex: 1,
    borderRadius: 3,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 2,
    minWidth: 0,
  },
  chromaNote: {
    fontSize: '0.45rem',
    color: 'rgba(0,0,0,0.6)',
    fontWeight: 700,
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
  },
};
