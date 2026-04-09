/**
 * Note & Music Theory Utilities
 * ==============================
 * Client-side helpers for note names, frequency conversion,
 * and music theory calculations.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const A4_FREQ = 440.0;
export const A4_MIDI = 69;

export function freqToMidi(freq) {
  if (freq <= 0) return 0;
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
}

export function midiToFreq(midi) {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function midiToNoteName(midi) {
  const noteIndex = Math.round(midi) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function freqToNoteName(freq) {
  if (freq <= 0) return '--';
  return midiToNoteName(freqToMidi(freq));
}

export function freqToCents(freq) {
  if (freq <= 0) return 0;
  const midi = freqToMidi(freq);
  return (midi - Math.round(midi)) * 100;
}

export function freqToPitchClass(freq) {
  if (freq <= 0) return -1;
  return Math.round(freqToMidi(freq)) % 12;
}

/**
 * Get the Y position for a MIDI note in a piano roll.
 * @param {number} midi - MIDI note number
 * @param {number} minNote - Lowest note displayed
 * @param {number} maxNote - Highest note displayed
 * @param {number} height - Canvas height in pixels
 */
export function midiToY(midi, minNote, maxNote, height) {
  const range = maxNote - minNote;
  if (range <= 0) return height / 2;
  return height - ((midi - minNote) / range) * height;
}

/**
 * Format a time in seconds to MM:SS.mmm
 */
export function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format a time in seconds to MM:SS
 */
export function formatTimeShort(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Check if a note name represents a black key.
 */
export function isBlackKey(noteName) {
  return noteName.includes('#') || noteName.includes('b');
}

/**
 * Get all note names from a MIDI range.
 */
export function getNoteRange(low = 36, high = 84) {
  const notes = [];
  for (let midi = low; midi <= high; midi++) {
    notes.push({
      midi,
      name: midiToNoteName(midi),
      freq: midiToFreq(midi),
      isBlack: isBlackKey(NOTE_NAMES[midi % 12]),
    });
  }
  return notes;
}
