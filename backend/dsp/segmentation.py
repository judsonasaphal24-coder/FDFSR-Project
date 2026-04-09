"""
Audio Segmentation Engine
=========================
Segments audio into notes, phrases, and sections using pitch
and onset information. Provides note-level events with precise
timing, pitch statistics, and confidence metrics.
"""
import numpy as np
from typing import List, Dict, Optional
from .audio_utils import freq_to_note_name, freq_to_midi, freq_to_cents


def segment_notes(
    pitch_track: List[Dict],
    onsets: List[Dict],
    min_note_duration: float = 0.05,
    pitch_stability_threshold: float = 1.0,
) -> List[Dict]:
    """
    Combine pitch track and onset data to produce note segments.

    Each note segment has:
    {
        'start_time': float,
        'end_time': float,
        'duration': float,
        'frequency': float,        # Average frequency
        'note': str,               # Note name
        'midi': float,             # MIDI note number
        'cents': float,            # Average cents deviation
        'confidence': float,       # Average confidence
        'pitch_drift': float,      # Cents drift from start to end
        'vibrato': bool,           # Whether vibrato was detected
        'velocity_estimate': float # 0-1 based on onset strength
    }
    """
    if not pitch_track:
        return []

    # Build onset times set for quick lookup
    onset_times = [o['time'] for o in onsets]
    onset_strengths = {round(o['time'], 4): o['strength'] for o in onsets}

    notes = []
    current_note = None
    prev_midi = None

    for pt in pitch_track:
        freq = pt['frequency']
        time = pt['time']
        conf = pt['confidence']
        midi = pt['midi']

        is_voiced = freq > 0 and conf > 0.3
        is_onset = _is_near_onset(time, onset_times, tolerance=0.03)
        pitch_changed = (
            prev_midi is not None
            and midi > 0
            and abs(midi - prev_midi) > pitch_stability_threshold
        )

        # Start new note on onset, pitch change, or voice entry
        if is_voiced and (is_onset or pitch_changed or current_note is None):
            # Close previous note
            if current_note is not None:
                _finalize_note(current_note, notes, min_note_duration)
            # Start new note
            current_note = {
                'start_time': time,
                'pitches': [],
                'confidences': [],
                'onset_strength': onset_strengths.get(round(time, 4), 0.5),
            }

        # Accumulate pitch data
        if current_note is not None and is_voiced:
            current_note['pitches'].append(freq)
            current_note['confidences'].append(conf)
        elif current_note is not None and not is_voiced:
            # Silence — close current note
            current_note['end_time'] = time
            _finalize_note(current_note, notes, min_note_duration)
            current_note = None

        prev_midi = midi if is_voiced else None

    # Close last note
    if current_note is not None and pitch_track:
        current_note['end_time'] = pitch_track[-1]['time']
        _finalize_note(current_note, notes, min_note_duration)

    return notes


def _is_near_onset(time: float, onset_times: List[float], tolerance: float = 0.03) -> bool:
    """Check if a time is near any onset event."""
    for ot in onset_times:
        if abs(time - ot) <= tolerance:
            return True
    return False


def _finalize_note(note_data: Dict, notes_list: List[Dict], min_duration: float):
    """Compute note statistics and append to list if valid."""
    pitches = note_data['pitches']
    if not pitches:
        return

    end_time = note_data.get('end_time', note_data['start_time'] + 0.1)
    duration = end_time - note_data['start_time']
    if duration < min_duration:
        return

    avg_freq = float(np.mean(pitches))
    avg_conf = float(np.mean(note_data['confidences']))

    # Pitch drift: cents difference between start and end
    if len(pitches) > 2:
        start_freq = np.mean(pitches[:3])
        end_freq = np.mean(pitches[-3:])
        if start_freq > 0 and end_freq > 0:
            drift = 1200.0 * np.log2(end_freq / start_freq)
        else:
            drift = 0.0
    else:
        drift = 0.0

    # Vibrato heuristic: std dev of pitch in cents
    if len(pitches) > 5 and avg_freq > 0:
        cents_deviations = [1200.0 * np.log2(p / avg_freq) for p in pitches if p > 0]
        pitch_variability = float(np.std(cents_deviations))
        has_vibrato = pitch_variability > 15.0  # >15 cents std = likely vibrato
    else:
        has_vibrato = False

    notes_list.append({
        'start_time': round(note_data['start_time'], 4),
        'end_time': round(end_time, 4),
        'duration': round(duration, 4),
        'frequency': round(avg_freq, 2),
        'note': freq_to_note_name(avg_freq),
        'midi': round(freq_to_midi(avg_freq), 2),
        'cents': round(freq_to_cents(avg_freq), 1),
        'confidence': round(avg_conf, 3),
        'pitch_drift': round(drift, 1),
        'vibrato': has_vibrato,
        'velocity_estimate': round(note_data.get('onset_strength', 0.5), 2),
    })


# ---------------------------------------------------------------------------
# Phrase & Section Detection
# ---------------------------------------------------------------------------

def detect_phrases(
    notes: List[Dict],
    silence_threshold: float = 0.3,
) -> List[Dict]:
    """
    Group notes into musical phrases based on gaps between notes.

    A phrase boundary is detected when there is a silence gap
    longer than `silence_threshold` seconds.

    Returns list of phrases:
    {
        'start_time': float,
        'end_time': float,
        'duration': float,
        'num_notes': int,
        'notes': List[Dict],
        'pitch_range': str,  # e.g. "C3-G5"
    }
    """
    if not notes:
        return []

    phrases = []
    current_phrase_notes = [notes[0]]

    for i in range(1, len(notes)):
        gap = notes[i]['start_time'] - notes[i - 1]['end_time']
        if gap > silence_threshold:
            # End current phrase, start new one
            phrases.append(_make_phrase(current_phrase_notes))
            current_phrase_notes = []
        current_phrase_notes.append(notes[i])

    if current_phrase_notes:
        phrases.append(_make_phrase(current_phrase_notes))

    return phrases


def _make_phrase(notes: List[Dict]) -> Dict:
    """Create a phrase descriptor from a list of notes."""
    midis = [n['midi'] for n in notes if n['midi'] > 0]
    if midis:
        low = freq_to_note_name(440.0 * 2 ** ((min(midis) - 69) / 12))
        high = freq_to_note_name(440.0 * 2 ** ((max(midis) - 69) / 12))
        pitch_range = f"{low}-{high}"
    else:
        pitch_range = "--"

    return {
        'start_time': notes[0]['start_time'],
        'end_time': notes[-1]['end_time'],
        'duration': round(notes[-1]['end_time'] - notes[0]['start_time'], 4),
        'num_notes': len(notes),
        'notes': notes,
        'pitch_range': pitch_range,
    }


def detect_sections(
    notes: List[Dict],
    chroma_changes: Optional[List[float]] = None,
    min_section_length: float = 4.0,
) -> List[Dict]:
    """
    Detect musical sections by analyzing harmonic changes over time.

    Sections are detected via significant shifts in pitch-class
    distribution (chroma features).

    Returns list of sections:
    {
        'start_time': float,
        'end_time': float,
        'label': str,  # Section label (A, B, C, ...)
    }
    """
    if not notes:
        return []

    total_duration = notes[-1]['end_time'] - notes[0]['start_time']
    if total_duration < min_section_length * 2:
        return [{
            'start_time': notes[0]['start_time'],
            'end_time': notes[-1]['end_time'],
            'label': 'A',
        }]

    # Simple approach: divide by phrase boundaries and group similar phrases
    phrases = detect_phrases(notes)
    sections = []
    label_idx = 0
    labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    for phrase in phrases:
        if not sections or phrase['start_time'] - sections[-1]['end_time'] > min_section_length:
            sections.append({
                'start_time': phrase['start_time'],
                'end_time': phrase['end_time'],
                'label': labels[label_idx % len(labels)],
            })
            label_idx += 1
        else:
            sections[-1]['end_time'] = phrase['end_time']

    return sections
