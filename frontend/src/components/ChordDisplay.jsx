/**
 * ChordDisplay Component
 * ======================
 * Shows chord progression timeline with Roman numerals
 * and harmonic function color coding.
 */
import React from 'react';
import { getHarmonicFunctionColor } from '../utils/colorUtils';
import { harmonicFunctionName } from '../utils/musicTheory';

export default function ChordDisplay({ chords = [], duration = 10 }) {
  if (chords.length === 0) {
    return (
      <div id="chord-display" style={styles.container}>
        <div className="label" style={{ padding: '4px 4px 4px' }}>CHORD PROGRESSION</div>
        <div style={styles.empty}>
          No chord data available. Record or upload audio to detect chords.
        </div>
      </div>
    );
  }

  return (
    <div id="chord-display" style={styles.container}>
      <div className="label" style={{ padding: '4px 4px 4px' }}>CHORD PROGRESSION</div>
      <div style={styles.timeline}>
        {chords.map((chord, i) => {
          const width = Math.max(
            ((chord.duration || 0.5) / Math.max(duration, 1)) * 100,
            3
          );
          const fnColor = getHarmonicFunctionColor(chord.harmonic_function || chord.function);

          return (
            <div
              key={i}
              style={{
                ...styles.chordBlock,
                width: `${width}%`,
                borderColor: fnColor + '40',
                background: fnColor + '10',
              }}
              title={`${chord.chord_symbol || chord.chord} (${chord.roman_numeral || chord.roman || '?'}) — ${harmonicFunctionName(chord.harmonic_function || chord.function || '')}`}
            >
              <span style={styles.chordSymbol}>
                {chord.chord_symbol || chord.chord}
              </span>
              <span style={{ ...styles.roman, color: fnColor }}>
                {chord.roman_numeral || chord.roman || ''}
              </span>
              {(chord.harmonic_function || chord.function) && (
                <span style={{
                  ...styles.funcLabel,
                  background: fnColor + '20',
                  color: fnColor,
                }}>
                  {chord.harmonic_function || chord.function}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  timeline: {
    display: 'flex',
    gap: 2,
    padding: 4,
    background: 'var(--bg-secondary)',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    overflowX: 'auto',
    minHeight: 70,
    alignItems: 'stretch',
  },
  chordBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 4px',
    borderRadius: 6,
    border: '1px solid',
    minWidth: 40,
    transition: 'all 150ms ease',
    cursor: 'default',
    flexShrink: 0,
  },
  chordSymbol: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-bright)',
    fontFamily: 'var(--font-mono)',
  },
  roman: {
    fontSize: '0.65rem',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
  },
  funcLabel: {
    fontSize: '0.5rem',
    fontWeight: 600,
    padding: '1px 5px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  empty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    background: 'var(--bg-secondary)',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
  },
};
