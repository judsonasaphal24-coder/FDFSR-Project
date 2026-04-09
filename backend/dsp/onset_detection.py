"""
Onset Detection Engine
======================
Detects note onsets (attack points) in audio using spectral flux
and energy-based methods. Provides onset times, strengths, and
onset strength envelope for visualization.
"""
import numpy as np
from typing import List, Dict, Tuple
from .audio_utils import compute_stft, compute_rms


def spectral_flux(
    signal: np.ndarray,
    sr: int = 44100,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> np.ndarray:
    """
    Compute half-wave rectified spectral flux.

    For each frame, measures the increase in spectral energy
    compared to the previous frame:
        SF(n) = Σ max(0, |X(n,k)| - |X(n-1,k)|)
    
    Half-wave rectification ensures only energy *increases*
    contribute, which correlates with note onsets.
    """
    S = np.abs(compute_stft(signal, n_fft, hop_length))  # magnitude spectrogram
    # Half-wave rectified difference
    diff = np.diff(S, axis=1)
    diff = np.maximum(0, diff)
    flux = np.sum(diff, axis=0)
    # Prepend zero for first frame
    return np.concatenate([[0.0], flux])


def energy_envelope(
    signal: np.ndarray,
    frame_size: int = 2048,
    hop_size: int = 512,
) -> np.ndarray:
    """
    Compute RMS energy envelope for onset detection backup.
    """
    num_frames = 1 + (len(signal) - frame_size) // hop_size
    envelope = np.zeros(num_frames)
    for i in range(num_frames):
        start = i * hop_size
        frame = signal[start:start + frame_size]
        envelope[i] = compute_rms(frame)
    return envelope


def adaptive_threshold(
    onset_strength: np.ndarray,
    window_size: int = 7,
    offset: float = 0.0,
    multiplier: float = 1.5,
) -> np.ndarray:
    """
    Compute adaptive threshold using local median + offset.

    threshold(n) = multiplier * median(onset_strength[n-w : n+w]) + offset
    """
    half_w = window_size // 2
    n = len(onset_strength)
    threshold = np.zeros(n)
    for i in range(n):
        start = max(0, i - half_w)
        end = min(n, i + half_w + 1)
        threshold[i] = multiplier * np.median(onset_strength[start:end]) + offset
    return threshold


def pick_peaks(
    onset_strength: np.ndarray,
    threshold: np.ndarray,
    min_distance_frames: int = 4,
) -> List[int]:
    """
    Peak-picking: find frames where onset strength exceeds the
    adaptive threshold and is a local maximum.

    Parameters
    ----------
    min_distance_frames : int
        Minimum number of frames between consecutive onsets
        (prevents double-triggering).
    """
    peaks = []
    n = len(onset_strength)

    for i in range(1, n - 1):
        if onset_strength[i] <= threshold[i]:
            continue
        # Must be local maximum
        if onset_strength[i] < onset_strength[i - 1]:
            continue
        if onset_strength[i] < onset_strength[i + 1]:
            continue
        # Minimum distance constraint
        if peaks and (i - peaks[-1]) < min_distance_frames:
            # Keep the stronger peak
            if onset_strength[i] > onset_strength[peaks[-1]]:
                peaks[-1] = i
            continue
        peaks.append(i)

    return peaks


def detect_onsets(
    signal: np.ndarray,
    sr: int = 44100,
    n_fft: int = 2048,
    hop_length: int = 512,
    threshold_multiplier: float = 1.5,
    min_onset_gap_ms: float = 50.0,
) -> List[Dict]:
    """
    Full onset detection pipeline.

    Returns list of onset events:
    {
        'time': float,       # Onset time in seconds
        'strength': float,   # Onset strength (0-1 normalized)
        'frame': int,        # Frame index
    }
    """
    # 1. Compute onset strength (spectral flux)
    flux = spectral_flux(signal, sr, n_fft, hop_length)

    # Normalize
    max_flux = np.max(flux)
    if max_flux > 0:
        flux_norm = flux / max_flux
    else:
        return []

    # 2. Adaptive threshold
    min_frames = max(1, int(min_onset_gap_ms * sr / (1000.0 * hop_length)))
    thresh = adaptive_threshold(flux_norm, window_size=max(7, min_frames * 2))

    # 3. Pick peaks
    peak_frames = pick_peaks(flux_norm, thresh, min_distance_frames=min_frames)

    # 4. Convert to time
    results = []
    for frame_idx in peak_frames:
        time = frame_idx * hop_length / sr
        results.append({
            'time': round(time, 4),
            'strength': round(float(flux_norm[frame_idx]), 3),
            'frame': int(frame_idx),
        })

    return results


def onset_strength_envelope(
    signal: np.ndarray,
    sr: int = 44100,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Return the onset strength envelope and corresponding times.
    Useful for visualization.
    """
    flux = spectral_flux(signal, sr, n_fft, hop_length)
    max_val = np.max(flux)
    if max_val > 0:
        flux = flux / max_val
    times = np.arange(len(flux)) * hop_length / sr
    return times, flux
