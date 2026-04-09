/**
 * Music Theory Utilities (Client-Side)
 * =====================================
 * Chord parsing, scale helpers, and display formatting.
 */

export const SCALE_INTERVALS = {
  major:          [0, 2, 4, 5, 7, 9, 11],
  natural_minor:  [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:  [0, 2, 3, 5, 7, 9, 11],
  dorian:         [0, 2, 3, 5, 7, 9, 10],
  phrygian:       [0, 1, 3, 5, 7, 8, 10],
  lydian:         [0, 2, 4, 6, 7, 9, 11],
  mixolydian:     [0, 2, 4, 5, 7, 9, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues:          [0, 3, 5, 6, 7, 10],
};

/**
 * Get the scale name for display (formatting).
 */
export function formatScaleName(scale) {
  return scale
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Parse chord symbol into root and quality.
 */
export function parseChord(symbol) {
  if (!symbol || symbol === 'N/C') {
    return { root: null, quality: null, display: 'N/C' };
  }
  const match = symbol.match(/^([A-G][#b]?)(.*)/);
  if (!match) return { root: null, quality: null, display: symbol };
  return {
    root: match[1],
    quality: match[2] || 'maj',
    display: symbol,
  };
}

/**
 * Get chord quality display name.
 */
export function chordQualityName(quality) {
  const names = {
    'maj': 'Major', 'min': 'Minor', 'm': 'Minor',
    'dim': 'Diminished', 'aug': 'Augmented',
    '7': 'Dominant 7th', 'maj7': 'Major 7th', 'min7': 'Minor 7th',
    'm7': 'Minor 7th', 'dim7': 'Diminished 7th',
    'sus2': 'Suspended 2nd', 'sus4': 'Suspended 4th',
    'power': 'Power Chord',
  };
  return names[quality] || quality;
}

/**
 * Get roman numeral display with proper styling.
 */
export function formatRomanNumeral(roman) {
  if (!roman) return '?';
  return roman;
}

/**
 * Get harmonic function full name.
 */
export function harmonicFunctionName(fn) {
  const names = {
    'T': 'Tonic', 'S': 'Subdominant', 'D': 'Dominant',
    'Chr': 'Chromatic',
  };
  return names[fn] || fn;
}
