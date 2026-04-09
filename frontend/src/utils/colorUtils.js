/**
 * Color Utilities
 * ===============
 * Color helpers for pitch visualization, velocity mapping,
 * and chord function coloring.
 */

/**
 * Get color based on cents deviation from perfect pitch.
 * Green = in tune, orange = slightly off, red = very off.
 */
export function getCentsColor(cents) {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return '#00ff88';      // Perfect
  if (absCents <= 15) return '#5dff5d';     // Very good
  if (absCents <= 25) return '#ffd700';     // Ok
  if (absCents <= 35) return '#ff8c00';     // Off
  return '#ff3e5e';                          // Very off
}

/**
 * Get color for a note based on confidence.
 */
export function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'rgba(0, 255, 136, 0.8)';
  if (confidence >= 0.5) return 'rgba(0, 212, 255, 0.7)';
  if (confidence >= 0.3) return 'rgba(168, 85, 247, 0.6)';
  return 'rgba(255, 160, 54, 0.4)';
}

/**
 * Get color for velocity value (0-127).
 */
export function getVelocityColor(velocity) {
  const v = velocity / 127;
  if (v < 0.3)  return `rgba(74, 111, 165, ${0.4 + v})`;
  if (v < 0.6)  return `rgba(124, 140, 248, ${0.5 + v * 0.5})`;
  if (v < 0.85) return `rgba(168, 85, 247, ${0.6 + v * 0.3})`;
  return `rgba(255, 62, 138, ${0.7 + v * 0.3})`;
}

/**
 * Get color for harmonic function.
 */
export function getHarmonicFunctionColor(func) {
  switch (func) {
    case 'T': case 'Tonic':       return '#00ff88';
    case 'S': case 'Subdominant': return '#ffa036';
    case 'D': case 'Dominant':    return '#ff3e8a';
    case 'Chr': case 'Chromatic': return '#a855f7';
    default:                      return '#6868804d';
  }
}

/**
 * Get color for a pitch class (chromatic).
 */
export function getPitchClassColor(pc) {
  const colors = [
    '#ff3e5e', '#ff6b35', '#ffa036', '#ffd700',
    '#a0e515', '#00ff88', '#00d4ff', '#3e9bff',
    '#7c8cf8', '#a855f7', '#d946ef', '#ff3e8a',
  ];
  return colors[pc % 12] || '#666';
}

/**
 * Interpolate between two hex colors.
 */
export function lerpColor(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
