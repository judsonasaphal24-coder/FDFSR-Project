"""
Chord Detection Engine
======================
Detects chords from chroma features using template matching with
cosine similarity. Supports major, minor, diminished, augmented,
dominant 7th, and other common chord types.
"""
import numpy as np
from typing import List, Dict, Tuple
from .audio_utils import NOTE_NAMES, compute_chroma


# ---------------------------------------------------------------------------
# Chord Templates
# ---------------------------------------------------------------------------
# Each template is a 12-element vector representing the presence
# of each pitch class in the chord (relative to root = index 0).

CHORD_TEMPLATES = {
    'maj':     [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],  # 1-3-5
    'min':     [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],  # 1-b3-5
    'dim':     [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],  # 1-b3-b5
    'aug':     [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],  # 1-3-#5
    '7':       [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],  # 1-3-5-b7
    'maj7':    [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],  # 1-3-5-7
    'min7':    [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],  # 1-b3-5-b7
    'dim7':    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],  # 1-b3-b5-bb7
    'hdim7':   [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],  # 1-b3-b5-b7 (half-dim)
    'sus2':    [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],  # 1-2-5
    'sus4':    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],  # 1-4-5
    'add9':    [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],  # 1-2-3-5
    '6':       [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],  # 1-3-5-6
    'min6':    [1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],  # 1-b3-5-6
    '9':       [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],  # 1-2-3-5-b7
    'power':   [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],  # 1-5 (power chord)
}


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def detect_chord_from_chroma(
    chroma_frame: np.ndarray,
    min_confidence: float = 0.5,
) -> Dict:
    """
    Detect the most likely chord from a single chroma frame.

    Parameters
    ----------
    chroma_frame : np.ndarray
        12-element chroma vector.
    min_confidence : float
        Minimum confidence to report a chord.

    Returns
    -------
    Dict with:
        'chord': str,          # e.g. "C maj", "A min7"
        'root': str,           # Root note name
        'quality': str,        # Chord quality (maj, min, etc.)
        'confidence': float,   # Cosine similarity score
    """
    best_score = -1.0
    best_chord = {'chord': 'N/C', 'root': '--', 'quality': '--', 'confidence': 0.0}

    for root_pc in range(12):
        for quality, template in CHORD_TEMPLATES.items():
            # Rotate template to match root
            rotated = np.roll(template, root_pc).astype(float)
            score = _cosine_similarity(chroma_frame, rotated)

            if score > best_score:
                best_score = score
                root_name = NOTE_NAMES[root_pc]
                # Display name formatting
                if quality == 'maj':
                    display = root_name
                elif quality == 'min':
                    display = f"{root_name}m"
                elif quality == '7':
                    display = f"{root_name}7"
                elif quality == 'maj7':
                    display = f"{root_name}maj7"
                elif quality == 'min7':
                    display = f"{root_name}m7"
                else:
                    display = f"{root_name}{quality}"

                best_chord = {
                    'chord': display,
                    'root': root_name,
                    'root_pc': root_pc,
                    'quality': quality,
                    'confidence': round(score, 3),
                }

    if best_chord['confidence'] < min_confidence:
        return {'chord': 'N/C', 'root': '--', 'quality': '--', 'confidence': 0.0}

    return best_chord


def detect_chords(
    signal: np.ndarray,
    sr: int = 44100,
    n_fft: int = 8192,
    hop_length: int = 4096,
    min_confidence: float = 0.5,
    smooth: bool = True,
) -> List[Dict]:
    """
    Detect chord progression over an audio signal.

    Uses larger FFT windows than pitch detection for better
    frequency resolution at low frequencies (important for bass notes).

    Returns list of chord events:
    {
        'time': float,
        'duration': float,
        'chord': str,
        'root': str,
        'quality': str,
        'confidence': float,
    }
    """
    chroma = compute_chroma(signal, sr, n_fft, hop_length)
    num_frames = chroma.shape[1]
    raw_chords = []

    for i in range(num_frames):
        time = i * hop_length / sr
        chord = detect_chord_from_chroma(chroma[:, i], min_confidence)
        chord['time'] = round(time, 3)
        raw_chords.append(chord)

    if smooth and len(raw_chords) > 2:
        raw_chords = _smooth_chords(raw_chords)

    # Merge consecutive identical chords
    merged = _merge_consecutive_chords(raw_chords, hop_length / sr)
    return merged


def _smooth_chords(chords: List[Dict], window: int = 3) -> List[Dict]:
    """
    Apply majority-vote smoothing to remove spurious chord changes.
    """
    if len(chords) <= window:
        return chords

    smoothed = list(chords)
    half = window // 2

    for i in range(half, len(chords) - half):
        neighbors = [chords[j]['chord'] for j in range(i - half, i + half + 1)]
        # Find most common chord in neighborhood
        from collections import Counter
        most_common = Counter(neighbors).most_common(1)[0][0]
        smoothed[i] = dict(chords[i])
        if chords[i]['chord'] != most_common:
            # Find the matching chord data
            for j in range(i - half, i + half + 1):
                if chords[j]['chord'] == most_common:
                    smoothed[i] = dict(chords[j])
                    smoothed[i]['time'] = chords[i]['time']
                    break

    return smoothed


def _merge_consecutive_chords(
    chords: List[Dict],
    frame_duration: float,
) -> List[Dict]:
    """Merge consecutive frames with the same chord into single events."""
    if not chords:
        return []

    merged = []
    current = dict(chords[0])
    current['duration'] = frame_duration

    for i in range(1, len(chords)):
        if chords[i]['chord'] == current['chord']:
            current['duration'] = round(current['duration'] + frame_duration, 4)
            current['confidence'] = round(
                (current['confidence'] + chords[i]['confidence']) / 2, 3
            )
        else:
            merged.append(current)
            current = dict(chords[i])
            current['duration'] = frame_duration

    merged.append(current)
    return merged


# ---------------------------------------------------------------------------
# Roman Numeral Analysis
# ---------------------------------------------------------------------------

# Diatonic triads for each scale degree in major key
MAJOR_DIATONIC = {
    0: ('I', 'maj'),    # Tonic
    2: ('II', 'min'),   # Supertonic
    4: ('III', 'min'),  # Mediant
    5: ('IV', 'maj'),   # Subdominant
    7: ('V', 'maj'),    # Dominant
    9: ('VI', 'min'),   # Submediant
    11: ('VII', 'dim'), # Leading tone
}

# Diatonic triads for natural minor
MINOR_DIATONIC = {
    0: ('i', 'min'),     # Tonic
    2: ('ii°', 'dim'),   # Supertonic
    3: ('III', 'maj'),   # Mediant
    5: ('iv', 'min'),    # Subdominant
    7: ('v', 'min'),     # Dominant (natural minor)
    8: ('VI', 'maj'),    # Submediant
    10: ('VII', 'maj'),  # Subtonic
}


def roman_numeral_analysis(
    chords: List[Dict],
    key: str,
    mode: str = 'major',
) -> List[Dict]:
    """
    Assign Roman numeral labels to chords based on the detected key.

    Parameters
    ----------
    chords : list of chord dicts (must include 'root_pc')
    key : str, tonic note name (e.g. 'C')
    mode : 'major' or 'minor'

    Returns chords with added 'roman' and 'function' fields.
    """
    tonic_pc = NOTE_NAMES.index(key) if key in NOTE_NAMES else 0
    diatonic = MAJOR_DIATONIC if mode == 'major' else MINOR_DIATONIC

    # Harmonic function mapping
    functions = {
        0: 'Tonic', 2: 'Subdominant', 3: 'Tonic', 4: 'Tonic',
        5: 'Subdominant', 7: 'Dominant', 8: 'Subdominant',
        9: 'Tonic', 10: 'Dominant', 11: 'Dominant',
    }

    result = []
    for chord in chords:
        entry = dict(chord)
        root_pc = chord.get('root_pc', -1)
        if root_pc < 0:
            entry['roman'] = '?'
            entry['function'] = 'Unknown'
            result.append(entry)
            continue

        # Scale degree relative to tonic
        degree = (root_pc - tonic_pc) % 12

        if degree in diatonic:
            entry['roman'] = diatonic[degree][0]
        else:
            # Chromatic chord — use accidentals
            entry['roman'] = f"#{degree}" if degree not in diatonic else '?'

        entry['function'] = functions.get(degree, 'Chromatic')
        result.append(entry)

    return result
