/**
 * MidiAnalysisDashboard Component
 * ================================
 * Deep analysis dashboard for MIDI files showing key, chords,
 * tempo, voice leading, statistics, and harmonic function distribution.
 */
import React, { useState } from 'react';
import { getHarmonicFunctionColor, getPitchClassColor } from '../utils/colorUtils';
import { NOTE_NAMES } from '../utils/noteUtils';

export default function MidiAnalysisDashboard({ analysis }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Upload a MIDI file to see deep analysis</div>
      </div>
    );
  }

  const key = analysis.key || {};
  const numNotes = analysis.num_notes || 0;
  const duration = analysis.duration || 0;
  const tempoStr = analysis.tempo_bpm || '--';
  const timeSig = analysis.time_signature || '4/4';
  const chords = analysis.chords || [];
  const voiceLeading = analysis.voice_leading || [];
  const pcDist = analysis.pitch_class_distribution || [];
  const harmonicFunctions = analysis.harmonic_functions || [];
  const romanNumerals = analysis.roman_numerals || [];
  const source = analysis.source === 'r' ? 'R Language' : 'Python (mido)';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'chords', label: 'Chords' },
    { id: 'harmony', label: 'Harmony' },
    { id: 'voiceleading', label: 'Voice Leading' },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>MIDI ANALYSIS</span>
          <span style={styles.sourceBadge}>
            Analyzed via {source}
          </span>
        </div>
        <div className="tab-bar" style={{ margin: 0 }}>
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
      </div>

      <div style={styles.content}>
        {activeTab === 'overview' && (
          <OverviewPanel
            keyData={key} numNotes={numNotes} duration={duration}
            tempo={tempoStr} timeSig={timeSig} numChords={chords.length}
            pcDist={pcDist} source={source}
          />
        )}
        {activeTab === 'chords' && (
          <ChordsPanel chords={romanNumerals.length ? romanNumerals : chords} />
        )}
        {activeTab === 'harmony' && (
          <HarmonyPanel
            harmonicFunctions={harmonicFunctions}
            chords={chords}
            keyData={key}
          />
        )}
        {activeTab === 'voiceleading' && (
          <VoiceLeadingPanel voiceLeading={voiceLeading} />
        )}
      </div>
    </div>
  );
}

/* ---------- Overview Panel ---------- */
function OverviewPanel({ keyData, numNotes, duration, tempo, timeSig, numChords, pcDist, source }) {
  return (
    <div style={styles.panelGrid}>
      {/* Key card */}
      <div style={styles.bigCard}>
        <span style={styles.bigCardLabel}>DETECTED KEY</span>
        <span style={styles.bigCardValue}>{keyData.key || '--'}</span>
        <div style={styles.confBar}>
          <div style={{
            ...styles.confFill,
            width: `${Math.min(100, (keyData.confidence || 0) * 100)}%`,
          }} />
        </div>
        <span style={styles.confText}>
          {Math.round((keyData.confidence || 0) * 100)}% confidence
        </span>
      </div>

      {/* Stats grid */}
      <div style={styles.statsRow}>
        <StatCard label="NOTES" value={numNotes} icon="♫" />
        <StatCard label="CHORDS" value={numChords} icon="🎸" />
        <StatCard label="TEMPO" value={`${tempo}`} unit="BPM" icon="⏱" />
        <StatCard label="TIME SIG" value={timeSig} icon="𝄞" />
        <StatCard label="DURATION" value={`${Math.round(duration)}s`} icon="⏳" />
        <StatCard label="SOURCE" value={source.split(' ')[0]} icon="🔬" />
      </div>

      {/* Pitch Class Distribution */}
      {pcDist && pcDist.length === 12 && (
        <div style={styles.chromaSection}>
          <span className="label">PITCH CLASS DISTRIBUTION</span>
          <div style={styles.chromaGrid}>
            {NOTE_NAMES.map((note, i) => {
              const val = pcDist[i] || 0;
              const maxVal = Math.max(...pcDist, 1);
              const height = Math.max(4, (val / maxVal) * 60);
              return (
                <div key={i} style={styles.chromaCol} title={`${note}: ${val.toFixed(2)}`}>
                  <div style={{
                    ...styles.chromaBar,
                    height,
                    background: getPitchClassColor(i),
                    opacity: 0.3 + (val / maxVal) * 0.7,
                  }} />
                  <span style={styles.chromaNote}>{note}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, icon }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statIcon}>{icon}</span>
      <span style={styles.statValue}>
        {value}{unit ? <span style={styles.statUnit}> {unit}</span> : null}
      </span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

/* ---------- Chords Panel ---------- */
function ChordsPanel({ chords }) {
  if (!chords.length) return <div style={styles.empty}>No chords detected</div>;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Time</th><th>Chord</th><th>Roman</th>
            <th>Function</th><th>Root</th><th>Quality</th><th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {chords.slice(0, 150).map((c, i) => {
            const fn = c.harmonic_function || c.function || '';
            const fnColor = getHarmonicFunctionColor(fn);
            return (
              <tr key={i}>
                <td className="mono">{c.time?.toFixed(2)}s</td>
                <td style={{ fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  {c.chord}
                </td>
                <td className="mono" style={{ color: fnColor }}>{c.roman || '--'}</td>
                <td>
                  {fn && (
                    <span style={{
                      fontSize: '0.55rem', fontWeight: 600,
                      padding: '2px 6px', borderRadius: 4,
                      background: fnColor + '20', color: fnColor,
                      border: `1px solid ${fnColor}30`,
                    }}>
                      {fn}
                    </span>
                  )}
                </td>
                <td className="mono">{c.root || '--'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.quality || '--'}</td>
                <td className="mono">{c.confidence != null ? Math.round(c.confidence * 100) + '%' : '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {chords.length > 150 && (
        <div style={styles.more}>Showing 150 of {chords.length} chord events</div>
      )}
    </div>
  );
}

/* ---------- Harmony Panel ---------- */
function HarmonyPanel({ harmonicFunctions, chords, keyData }) {
  // Calculate harmonic function distribution
  const funcCounts = {};
  for (const hf of harmonicFunctions) {
    const fn = hf.function_label || hf.harmonic_function || '';
    if (fn) funcCounts[fn] = (funcCounts[fn] || 0) + 1;
  }
  const total = Object.values(funcCounts).reduce((s, v) => s + v, 0) || 1;

  // Unique chords
  const uniqueChords = [...new Set(chords.map(c => c.chord))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Function distribution */}
      <div>
        <span className="label">HARMONIC FUNCTION DISTRIBUTION</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {Object.entries(funcCounts).sort((a, b) => b[1] - a[1]).map(([fn, count]) => {
            const pct = count / total;
            const color = getHarmonicFunctionColor(fn);
            return (
              <div key={fn} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 30, fontWeight: 700, color, fontSize: '0.85rem' }}>{fn}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${pct * 100}%`,
                    background: color, opacity: 0.7,
                    transition: 'width 400ms ease',
                  }} />
                </div>
                <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unique chords */}
      <div>
        <span className="label">UNIQUE CHORD VOCABULARY ({uniqueChords.length})</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {uniqueChords.map((ch, i) => (
            <span key={i} style={{
              padding: '4px 10px', borderRadius: 6,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-primary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {ch}
            </span>
          ))}
        </div>
      </div>

      {/* Harmonic timeline */}
      <div>
        <span className="label">HARMONIC FUNCTIONS OVER TIME</span>
        <div style={styles.hfTimeline}>
          {harmonicFunctions.slice(0, 60).map((hf, i) => {
            const fn = hf.function_label || hf.harmonic_function || '';
            const color = getHarmonicFunctionColor(fn);
            return (
              <div key={i} title={`${hf.chord} (${fn}) at ${hf.time?.toFixed(1)}s`}
                style={{
                  flex: '1 0 auto', minWidth: 6, height: 24,
                  background: color, opacity: 0.6, borderRadius: 2,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Voice Leading Panel ---------- */
function VoiceLeadingPanel({ voiceLeading }) {
  if (!voiceLeading.length) return <div style={styles.empty}>No voice leading data</div>;

  // Motion type distribution
  const motionCounts = {};
  for (const vl of voiceLeading) {
    const t = vl.motion_type || 'unknown';
    motionCounts[t] = (motionCounts[t] || 0) + 1;
  }
  const total = voiceLeading.length;

  const motionColors = {
    step: '#00ff88', small_leap: '#00d4ff', leap: '#ffa036',
    static: '#a855f7', unknown: '#666',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Motion distribution */}
      <div>
        <span className="label">MOTION TYPE DISTRIBUTION</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {Object.entries(motionCounts).map(([type, count]) => (
            <div key={type} style={styles.motionCard}>
              <div style={{
                ...styles.motionDot,
                background: motionColors[type] || '#666',
              }} />
              <span style={styles.motionLabel}>{type.replace('_', ' ')}</span>
              <span style={styles.motionPct}>{Math.round(count / total * 100)}%</span>
              <span style={styles.motionCount}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Voice leading table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>From</th><th>To</th><th>Interval</th>
              <th>Direction</th><th>Motion</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {voiceLeading.slice(0, 80).map((vl, i) => {
              const from = vl.from_note || vl.from || '';
              const to = vl.to_note || vl.to || '';
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }} className="mono">{from}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-secondary)' }} className="mono">{to}</td>
                  <td className="mono">{vl.semitones} st</td>
                  <td>
                    <span style={{
                      color: vl.direction === 'up' ? 'var(--accent-secondary)' :
                             vl.direction === 'down' ? 'var(--accent-warm)' : 'var(--text-muted)',
                    }}>
                      {vl.direction === 'up' ? '↑' : vl.direction === 'down' ? '↓' : '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      ...styles.motionBadge,
                      background: (motionColors[vl.motion_type] || '#666') + '20',
                      color: motionColors[vl.motion_type] || '#666',
                    }}>
                      {(vl.motion_type || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>{vl.time?.toFixed(2)}s</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    border: '1px solid var(--border-subtle)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  sourceBadge: {
    fontSize: '0.55rem',
    padding: '2px 8px',
    borderRadius: 9999,
    background: 'rgba(168, 85, 247, 0.12)',
    color: 'var(--accent-purple)',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    fontWeight: 500,
  },
  content: {
    overflow: 'auto',
    maxHeight: 500,
  },
  panelGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  bigCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '16px 12px',
    background: 'rgba(0, 212, 255, 0.04)',
    borderRadius: 10,
    border: '1px solid rgba(0, 212, 255, 0.1)',
  },
  bigCardLabel: {
    fontSize: '0.55rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  bigCardValue: {
    fontSize: '1.8rem',
    fontWeight: 800,
    color: 'var(--accent-primary)',
    textShadow: '0 0 25px var(--glow-primary)',
    letterSpacing: '-0.02em',
  },
  confBar: {
    width: '80%',
    height: 4,
    background: 'var(--bg-surface)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
    borderRadius: 2,
    transition: 'width 300ms ease',
  },
  confText: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
    gap: 6,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 6px',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  statIcon: { fontSize: '0.9rem', opacity: 0.7 },
  statValue: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--text-bright)',
    fontFamily: 'var(--font-mono)',
  },
  statUnit: {
    fontSize: '0.55rem',
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  statLabel: {
    fontSize: '0.5rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  chromaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  chromaGrid: {
    display: 'flex',
    gap: 4,
    alignItems: 'flex-end',
    height: 80,
    padding: '8px 4px',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
  },
  chromaCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chromaBar: {
    width: '100%',
    borderRadius: 3,
    transition: 'height 300ms ease',
  },
  chromaNote: {
    fontSize: '0.5rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  hfTimeline: {
    display: 'flex',
    gap: 2,
    marginTop: 8,
    padding: 4,
    background: 'var(--bg-elevated)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.68rem',
    color: 'var(--text-primary)',
  },
  more: {
    textAlign: 'center',
    padding: 8,
    color: 'var(--text-muted)',
    fontSize: '0.6rem',
  },
  motionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '10px 14px',
    background: 'var(--bg-elevated)',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    flex: 1,
  },
  motionDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  motionLabel: {
    fontSize: '0.6rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'capitalize',
  },
  motionPct: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-bright)',
    fontFamily: 'var(--font-mono)',
  },
  motionCount: {
    fontSize: '0.5rem',
    color: 'var(--text-muted)',
  },
  motionBadge: {
    fontSize: '0.55rem',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'capitalize',
  },
  empty: {
    padding: '28px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
};
