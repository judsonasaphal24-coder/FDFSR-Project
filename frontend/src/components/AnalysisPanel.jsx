/**
 * AnalysisPanel Component
 * =======================
 * Tabbed panel showing detailed analysis: Pitch, Chords, Key, Theory.
 */
import React, { useState } from 'react';
import { formatTimeShort } from '../utils/noteUtils';
import { getHarmonicFunctionColor, getCentsColor } from '../utils/colorUtils';

export default function AnalysisPanel({
  pitchData = [],
  noteSegments = [],
  chordEvents = [],
  analysis = null,
  theoryAnalysis = null,
  onExport,
  onRunTheory,
  loading = false,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes' },
    { id: 'chords', label: 'Chords' },
    { id: 'theory', label: 'Theory' },
  ];

  return (
    <div id="analysis-panel" style={styles.container}>
      <div style={styles.header}>
        <div className="tab-bar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={styles.actions}>
          {onRunTheory && (
            <button className="btn btn-sm" onClick={onRunTheory} disabled={loading}>
              {loading ? '⏳' : '🎵'} Run Theory
            </button>
          )}
          {onExport && (
            <button className="btn btn-sm" onClick={onExport}>
              📤 Export JSON
            </button>
          )}
        </div>
      </div>

      <div style={styles.content}>
        {activeTab === 'overview' && (
          <OverviewTab analysis={analysis} noteSegments={noteSegments} chordEvents={chordEvents} />
        )}
        {activeTab === 'notes' && (
          <NotesTab notes={noteSegments} />
        )}
        {activeTab === 'chords' && (
          <ChordsTab chords={chordEvents} />
        )}
        {activeTab === 'theory' && (
          <TheoryTab theory={theoryAnalysis} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analysis, noteSegments, chordEvents }) {
  if (!analysis) {
    return <div style={styles.empty}>Upload and analyze audio to see results.</div>;
  }
  const json = analysis.analysis_json || {};
  const stats = json.statistics || {};

  return (
    <div style={styles.grid}>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>{analysis.key || '--'}</span>
        <span style={styles.statDesc}>Detected Key</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>{Math.round((analysis.key_confidence || 0) * 100)}%</span>
        <span style={styles.statDesc}>Key Confidence</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>{stats.total_notes || noteSegments.length}</span>
        <span style={styles.statDesc}>Notes Detected</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>{stats.total_chords || chordEvents.length}</span>
        <span style={styles.statDesc}>Chords Found</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>{stats.total_phrases || 0}</span>
        <span style={styles.statDesc}>Phrases</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statNumber}>
          {stats.duration ? `${Math.round(stats.duration)}s` : '--'}
        </span>
        <span style={styles.statDesc}>Duration</span>
      </div>
    </div>
  );
}

function NotesTab({ notes }) {
  if (notes.length === 0) return <div style={styles.empty}>No notes detected.</div>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Time</th><th>Note</th><th>Freq</th><th>Cents</th>
            <th>Duration</th><th>Confidence</th><th>Vibrato</th>
          </tr>
        </thead>
        <tbody>
          {notes.slice(0, 100).map((n, i) => (
            <tr key={i}>
              <td className="mono">{formatTimeShort(n.start_time)}</td>
              <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{n.note_name}</td>
              <td className="mono">{n.frequency} Hz</td>
              <td style={{ color: getCentsColor(n.cents) }} className="mono">
                {n.cents > 0 ? '+' : ''}{n.cents}¢
              </td>
              <td className="mono">{n.duration?.toFixed(2)}s</td>
              <td className="mono">{Math.round(n.confidence * 100)}%</td>
              <td>{n.has_vibrato ? '〰️' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes.length > 100 && (
        <div style={styles.more}>Showing 100 of {notes.length} notes</div>
      )}
    </div>
  );
}

function ChordsTab({ chords }) {
  if (chords.length === 0) return <div style={styles.empty}>No chords detected.</div>;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Time</th><th>Chord</th><th>Roman</th>
            <th>Function</th><th>Duration</th><th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {chords.slice(0, 100).map((c, i) => {
            const fnColor = getHarmonicFunctionColor(c.harmonic_function);
            return (
              <tr key={i}>
                <td className="mono">{formatTimeShort(c.time)}</td>
                <td style={{ color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {c.chord_symbol}
                </td>
                <td className="mono" style={{ color: fnColor }}>{c.roman_numeral}</td>
                <td>
                  <span style={{
                    ...styles.funcBadge,
                    background: fnColor + '20',
                    color: fnColor,
                    borderColor: fnColor + '30',
                  }}>
                    {c.harmonic_function || '--'}
                  </span>
                </td>
                <td className="mono">{c.duration?.toFixed(2)}s</td>
                <td className="mono">{Math.round(c.confidence * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TheoryTab({ theory }) {
  if (!theory) {
    return <div style={styles.empty}>Click "Run Theory" to analyze harmonic structure.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Matched progressions */}
      {theory.matched_progressions?.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>MATCHED PATTERNS</div>
          {theory.matched_progressions.map((p, i) => (
            <div key={i} style={styles.patternCard}>
              <span style={styles.patternName}>{p.name}</span>
              <span style={styles.patternFormula}>{p.pattern}</span>
              <span style={styles.patternStyle}>{p.style}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cadences */}
      {theory.cadences?.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>CADENCES</div>
          {theory.cadences.map((c, i) => (
            <div key={i} style={styles.cadenceCard}>
              <span className="badge">{c.type}</span>
              <span style={styles.cadenceChords}>
                {c.chords?.join(' → ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Harmonic distribution */}
      {theory.harmonic_function_distribution && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>HARMONIC DISTRIBUTION</div>
          <div style={styles.distGrid}>
            {Object.entries(theory.harmonic_function_distribution).map(([fn, pct]) => (
              <div key={fn} style={styles.distItem}>
                <span style={{ color: getHarmonicFunctionColor(fn), fontWeight: 600, fontSize: '0.8rem' }}>
                  {fn}
                </span>
                <div style={styles.distBar}>
                  <div style={{
                    ...styles.distFill,
                    width: `${pct * 100}%`,
                    background: getHarmonicFunctionColor(fn),
                  }} />
                </div>
                <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            ))}
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
    background: 'var(--bg-secondary)',
    borderRadius: 10,
    border: '1px solid var(--border-subtle)',
    padding: 10,
    minHeight: 200,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  actions: {
    display: 'flex',
    gap: 6,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
  },
  statNumber: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--accent-primary)',
    fontFamily: 'var(--font-mono)',
  },
  statDesc: {
    fontSize: '0.55rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: 2,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.7rem',
    color: 'var(--text-primary)',
  },
  funcBadge: {
    fontSize: '0.55rem',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  more: {
    textAlign: 'center',
    padding: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.65rem',
  },
  patternCard: {
    display: 'flex',
    gap: 10,
    padding: '8px 10px',
    background: 'var(--bg-elevated)',
    borderRadius: 6,
    marginBottom: 4,
    alignItems: 'center',
  },
  patternName: {
    fontWeight: 600,
    color: 'var(--text-bright)',
    fontSize: '0.75rem',
  },
  patternFormula: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    color: 'var(--accent-primary)',
  },
  patternStyle: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  cadenceCard: {
    display: 'flex',
    gap: 8,
    padding: '6px 8px',
    background: 'var(--bg-elevated)',
    borderRadius: 6,
    marginBottom: 4,
    alignItems: 'center',
  },
  cadenceChords: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    color: 'var(--text-primary)',
  },
  distGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  distItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  distBar: {
    flex: 1,
    height: 6,
    background: 'var(--bg-surface)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 300ms ease',
    opacity: 0.7,
  },
};
