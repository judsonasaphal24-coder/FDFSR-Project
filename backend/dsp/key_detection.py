"""
Key Detection Engine
====================
Implements the Krumhansl-Schmuckler key-finding algorithm to detect
the musical key from pitch data or chroma features.

Algorithm Reference:
    Krumhansl, C. L. (1990). "Cognitive Foundations of Musical Pitch."
    Oxford University Press.

    Temperley, D. (1999). "What's Key for Key? The Krumhansl-Schmuckler
    Key-Finding Algorithm Reconsidered."
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from .audio_utils import NOTE_NAMES, freq_to_pitch_class


# ---------------------------------------------------------------------------
# Key Profiles (Krumhansl-Kessler weights)
# ---------------------------------------------------------------------------
# These weights represent the perceived stability of each pitch class
# relative to a given key. Derived from probe-tone experiments.

MAJOR_PROFILE = np.array([
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
    2.52, 5.19, 2.39, 3.66, 2.29, 2.88
])

MINOR_PROFILE = np.array([
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
    2.54, 4.75, 3.98, 2.69, 3.34, 3.17
])

# Alternative: Temperley profiles (sometimes more accurate for pop music)
TEMPERLEY_MAJOR = np.array([
    5.0, 2.0, 3.5, 2.0, 4.5, 4.0,
    2.0, 4.5, 2.0, 3.5, 1.5, 4.0
])

TEMPERLEY_MINOR = np.array([
    5.0, 2.0, 3.5, 4.5, 2.0, 4.0,
    2.0, 4.5, 3.5, 2.0, 1.5, 4.0
])


def _rotate_profile(profile: np.ndarray, steps: int) -> np.ndarray:
    """Rotate a key profile by N steps (for transposition)."""
    return np.roll(profile, steps)


def _pearson_correlation(x: np.ndarray, y: np.ndarray) -> float:
    """Compute Pearson correlation between two vectors."""
    x_mean = x - np.mean(x)
    y_mean = y - np.mean(y)
    num = np.sum(x_mean * y_mean)
    den = np.sqrt(np.sum(x_mean ** 2) * np.sum(y_mean ** 2))
    if den == 0:
        return 0.0
    return float(num / den)


# ---------------------------------------------------------------------------
# Core Key Detection
# ---------------------------------------------------------------------------

def detect_key_from_chroma(
    chroma: np.ndarray,
    use_temperley: bool = False,
) -> Dict:
    """
    Detect key from a chroma vector (12-dimensional pitch class distribution).

    The algorithm correlates the input chroma with all 24 transposed
    key profiles (12 major + 12 minor) and selects the highest correlation.

    Parameters
    ----------
    chroma : np.ndarray
        Shape (12,) — total energy for each pitch class.
    use_temperley : bool
        If True, use Temperley profiles instead of Krumhansl-Kessler.

    Returns
    -------
    Dict with:
        'key': str,           # e.g. "C major", "A minor"
        'tonic': str,         # e.g. "C", "A"
        'mode': str,          # "major" or "minor"
        'confidence': float,  # Correlation value [0, 1]
        'all_keys': List,     # All 24 keys ranked by correlation
    """
    major = TEMPERLEY_MAJOR if use_temperley else MAJOR_PROFILE
    minor = TEMPERLEY_MINOR if use_temperley else MINOR_PROFILE

    correlations = []

    for i in range(12):
        # Major key rooted at pitch class i
        maj_profile = _rotate_profile(major, i)
        maj_corr = _pearson_correlation(chroma, maj_profile)
        correlations.append({
            'key': f"{NOTE_NAMES[i]} major",
            'tonic': NOTE_NAMES[i],
            'mode': 'major',
            'correlation': round(maj_corr, 4),
        })

        # Minor key rooted at pitch class i
        min_profile = _rotate_profile(minor, i)
        min_corr = _pearson_correlation(chroma, min_profile)
        correlations.append({
            'key': f"{NOTE_NAMES[i]} minor",
            'tonic': NOTE_NAMES[i],
            'mode': 'minor',
            'correlation': round(min_corr, 4),
        })

    # Sort by correlation (descending)
    correlations.sort(key=lambda x: x['correlation'], reverse=True)

    best = correlations[0]
    return {
        'key': best['key'],
        'tonic': best['tonic'],
        'mode': best['mode'],
        'confidence': max(0.0, best['correlation']),
        'runner_up': correlations[1]['key'],
        'runner_up_confidence': max(0.0, correlations[1]['correlation']),
        'all_keys': correlations,
    }


def detect_key_from_pitches(
    pitch_track: List[Dict],
    use_temperley: bool = False,
) -> Dict:
    """
    Detect key from a pitch track (list of pitch detection results).
    Builds a pitch class histogram and runs Krumhansl-Schmuckler.
    """
    chroma = np.zeros(12)
    for pt in pitch_track:
        freq = pt.get('frequency', 0)
        if freq > 0:
            pc = freq_to_pitch_class(freq)
            if 0 <= pc < 12:
                weight = pt.get('confidence', 1.0)
                chroma[pc] += weight

    # Normalize
    total = np.sum(chroma)
    if total > 0:
        chroma = chroma / total

    return detect_key_from_chroma(chroma, use_temperley)


def detect_key_from_notes(
    notes: List[Dict],
    use_temperley: bool = False,
) -> Dict:
    """
    Detect key from note segments (weighted by duration).
    """
    chroma = np.zeros(12)
    for note in notes:
        freq = note.get('frequency', 0)
        duration = note.get('duration', 0.1)
        if freq > 0:
            pc = freq_to_pitch_class(freq)
            if 0 <= pc < 12:
                chroma[pc] += duration  # Weight by duration

    total = np.sum(chroma)
    if total > 0:
        chroma = chroma / total

    return detect_key_from_chroma(chroma, use_temperley)


# ---------------------------------------------------------------------------
# Scale Detection
# ---------------------------------------------------------------------------

# Scale templates (pitch classes present)
SCALE_TEMPLATES = {
    'major':            [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    'natural_minor':    [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    'harmonic_minor':   [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1],
    'melodic_minor':    [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    'dorian':           [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
    'phrygian':         [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    'lydian':           [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
    'mixolydian':       [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
    'pentatonic_major': [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    'pentatonic_minor': [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0],
    'blues':            [1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0],
    'whole_tone':       [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    'chromatic':        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
}


def detect_scale(
    chroma: np.ndarray,
    tonic_pc: int = 0,
) -> List[Dict]:
    """
    Given a chroma distribution and a tonic pitch class,
    determine which scale(s) best fit the data.

    Returns ranked list of scale matches.
    """
    results = []

    for scale_name, template in SCALE_TEMPLATES.items():
        rotated = np.roll(template, tonic_pc)
        # Weighted match: how much of the chroma energy falls on scale tones
        scale_energy = np.sum(chroma * rotated)
        total_energy = np.sum(chroma)
        if total_energy > 0:
            fit = scale_energy / total_energy
        else:
            fit = 0.0

        results.append({
            'scale': scale_name,
            'tonic': NOTE_NAMES[tonic_pc],
            'fit': round(fit, 4),
            'label': f"{NOTE_NAMES[tonic_pc]} {scale_name}",
        })

    results.sort(key=lambda x: x['fit'], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Rolling Key Detection (for real-time / sectional analysis)
# ---------------------------------------------------------------------------

def detect_key_rolling(
    pitch_track: List[Dict],
    window_seconds: float = 4.0,
    hop_seconds: float = 1.0,
) -> List[Dict]:
    """
    Detect key over a rolling window of time.
    Useful for pieces that modulate between keys.

    Returns list of key detections with timestamps.
    """
    if not pitch_track:
        return []

    results = []
    times = [pt['time'] for pt in pitch_track]
    total_time = times[-1] if times else 0

    window_start = 0.0
    while window_start + window_seconds <= total_time:
        window_end = window_start + window_seconds
        # Collect pitches in window
        window_pitches = [
            pt for pt in pitch_track
            if window_start <= pt['time'] < window_end
        ]
        if window_pitches:
            key_result = detect_key_from_pitches(window_pitches)
            results.append({
                'time': round(window_start, 2),
                'window_end': round(window_end, 2),
                'key': key_result['key'],
                'confidence': key_result['confidence'],
            })
        window_start += hop_seconds

    return results
