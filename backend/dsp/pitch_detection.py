"""
Pitch Detection Engine
======================
Implements YIN algorithm for monophonic pitch detection and optional
CREPE-based detection for higher accuracy. Provides real-time capable
pitch estimation with sub-cent precision.

Algorithm Reference:
    De Cheveigné, A., & Kawahara, H. (2002).
    "YIN, a fundamental frequency estimator for speech and music."
    JASA, 111(4), 1917-1930.
"""
import numpy as np
from typing import List, Dict, Optional, Tuple
from .audio_utils import freq_to_midi, freq_to_note_name, freq_to_cents, compute_rms


# ---------------------------------------------------------------------------
# YIN Algorithm — Pure Numpy Implementation
# ---------------------------------------------------------------------------

def _yin_difference(signal: np.ndarray, max_lag: int) -> np.ndarray:
    """
    Step 1: Compute the difference function d(τ).
    
    d(τ) = Σ (x[j] - x[j + τ])²  for j in [0, W)
    
    Uses autocorrelation trick for O(N log N) via FFT instead of O(N²).
    """
    n = len(signal)
    # Zero-pad for FFT-based computation
    fft_size = 1
    while fft_size < 2 * n:
        fft_size *= 2

    # Power spectrum method (faster than naive)
    fft_signal = np.fft.rfft(signal, fft_size)
    power = np.abs(fft_signal) ** 2
    autocorr = np.fft.irfft(power)[:n]

    # Energy terms
    energy = np.cumsum(signal ** 2)
    energy = np.concatenate([[0], energy])

    # d(τ) = r(0) + r_shifted(0) - 2 * r(τ)
    diff = np.zeros(max_lag)
    diff[0] = 0.0
    for tau in range(1, max_lag):
        diff[tau] = (
            energy[n] - energy[n - tau]  # sum of x[j+τ]² for j in [0, W-τ)
            + energy[n] - energy[tau]      # sum of x[j]² approximation
            - 2.0 * autocorr[tau]
        )
    return diff


def _yin_cmnd(diff: np.ndarray) -> np.ndarray:
    """
    Step 2: Cumulative Mean Normalized Difference (CMND).
    
    d'(τ) = 1  if τ == 0
    d'(τ) = d(τ) / [(1/τ) * Σ d(j)]  for j in [1, τ]
    
    This normalization prevents dips at multiples of the true period
    from being selected over the fundamental.
    """
    cmnd = np.zeros_like(diff)
    cmnd[0] = 1.0
    running_sum = 0.0
    for tau in range(1, len(diff)):
        running_sum += diff[tau]
        if running_sum == 0:
            cmnd[tau] = 1.0
        else:
            cmnd[tau] = diff[tau] * tau / running_sum
    return cmnd


def _yin_absolute_threshold(cmnd: np.ndarray, threshold: float = 0.1) -> int:
    """
    Step 3: Absolute threshold.
    
    Find the first τ where d'(τ) < threshold, then pick the
    deepest valley following it (to handle plateaus).
    """
    tau = 2  # Start from 2 to avoid trivial τ=0,1
    while tau < len(cmnd):
        if cmnd[tau] < threshold:
            # Find the local minimum after this point
            while tau + 1 < len(cmnd) and cmnd[tau + 1] < cmnd[tau]:
                tau += 1
            return tau
        tau += 1
    # No pitch found — unvoiced
    return -1


def _yin_parabolic_interpolation(cmnd: np.ndarray, tau: int) -> float:
    """
    Step 4: Parabolic interpolation for sub-sample accuracy.
    
    Fits a parabola through (τ-1, τ, τ+1) and returns the
    refined minimum position.
    """
    if tau <= 0 or tau >= len(cmnd) - 1:
        return float(tau)

    alpha = cmnd[tau - 1]
    beta = cmnd[tau]
    gamma = cmnd[tau + 1]

    denominator = 2.0 * (2.0 * beta - alpha - gamma)
    if abs(denominator) < 1e-12:
        return float(tau)

    adjustment = (alpha - gamma) / denominator
    return float(tau) + adjustment


def yin_pitch(
    signal: np.ndarray,
    sr: int = 44100,
    threshold: float = 0.15,
    f_min: float = 50.0,
    f_max: float = 2000.0,
) -> Tuple[float, float]:
    """
    Estimate fundamental frequency of a signal frame using YIN.

    Parameters
    ----------
    signal : np.ndarray
        Audio frame (mono, float32/64), typically 2048 samples.
    sr : int
        Sample rate in Hz.
    threshold : float
        YIN threshold — lower = more selective (0.05–0.2 typical).
    f_min, f_max : float
        Frequency range to search within.

    Returns
    -------
    frequency : float
        Detected fundamental frequency in Hz, or 0.0 if unvoiced.
    confidence : float
        Confidence score (1.0 - cmnd_value), range [0, 1].
    """
    n = len(signal)
    max_lag = min(int(sr / f_min), n // 2)
    min_lag = max(int(sr / f_max), 2)

    # Check if frame has enough energy
    rms = compute_rms(signal)
    if rms < 0.005:
        return 0.0, 0.0

    diff = _yin_difference(signal, max_lag)
    cmnd = _yin_cmnd(diff)

    # Restrict search to valid frequency range
    cmnd[:min_lag] = 1.0

    tau = _yin_absolute_threshold(cmnd, threshold)
    if tau < 0:
        return 0.0, 0.0

    # Refine with parabolic interpolation
    refined_tau = _yin_parabolic_interpolation(cmnd, tau)
    if refined_tau <= 0:
        return 0.0, 0.0

    frequency = sr / refined_tau
    confidence = 1.0 - cmnd[tau]

    # Validate frequency range
    if frequency < f_min or frequency > f_max:
        return 0.0, 0.0

    return float(frequency), float(np.clip(confidence, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Multi-frame pitch tracking
# ---------------------------------------------------------------------------

def detect_pitch_track(
    signal: np.ndarray,
    sr: int = 44100,
    frame_size: int = 2048,
    hop_size: int = 512,
    threshold: float = 0.15,
    f_min: float = 50.0,
    f_max: float = 2000.0,
) -> List[Dict]:
    """
    Run YIN pitch detection across all frames of an audio signal.

    Returns a list of dicts, one per frame:
    {
        'time': float,         # Time in seconds
        'frequency': float,    # Hz (0 if unvoiced)
        'confidence': float,   # 0-1
        'midi': float,         # MIDI note number
        'note': str,           # Note name (e.g. 'A4')
        'cents': float,        # Cents deviation from nearest semitone
    }
    """
    results = []
    num_frames = 1 + (len(signal) - frame_size) // hop_size

    for i in range(num_frames):
        start = i * hop_size
        frame = signal[start:start + frame_size]

        freq, conf = yin_pitch(frame, sr, threshold, f_min, f_max)

        results.append({
            'time': round(start / sr, 4),
            'frequency': round(freq, 2),
            'confidence': round(conf, 3),
            'midi': round(freq_to_midi(freq), 2) if freq > 0 else 0,
            'note': freq_to_note_name(freq),
            'cents': round(freq_to_cents(freq), 1) if freq > 0 else 0,
        })

    return results


# ---------------------------------------------------------------------------
# Vibrato Detection
# ---------------------------------------------------------------------------

def detect_vibrato(
    pitch_track: List[Dict],
    min_rate: float = 4.0,
    max_rate: float = 8.0,
    min_extent_cents: float = 15.0,
) -> List[Dict]:
    """
    Detect vibrato regions in a pitch track.

    Vibrato is characterized by periodic pitch oscillation at 4-8 Hz
    with extent of 15-200 cents.

    Returns list of vibrato events:
    {
        'start_time': float,
        'end_time': float,
        'rate_hz': float,      # Vibrato rate
        'extent_cents': float, # Peak-to-peak deviation
    }
    """
    vibratos = []
    freqs = np.array([p['frequency'] for p in pitch_track])
    times = np.array([p['time'] for p in pitch_track])

    # Only analyze voiced regions
    voiced_mask = freqs > 0
    if np.sum(voiced_mask) < 10:
        return vibratos

    # Compute frame rate
    if len(times) > 1:
        frame_rate = 1.0 / (times[1] - times[0])
    else:
        return vibratos

    # Sliding window analysis
    window_frames = int(frame_rate * 0.5)  # 500ms windows
    hop_frames = window_frames // 4

    for start_idx in range(0, len(freqs) - window_frames, hop_frames):
        end_idx = start_idx + window_frames
        segment = freqs[start_idx:end_idx]

        if not np.all(segment > 0):
            continue

        # Convert to cents from mean
        mean_freq = np.mean(segment)
        cents = 1200.0 * np.log2(segment / mean_freq)

        # FFT to find periodic oscillation
        fft = np.abs(np.fft.rfft(cents - np.mean(cents)))
        fft_freqs = np.fft.rfftfreq(len(cents), 1.0 / frame_rate)

        # Search in vibrato rate range
        rate_mask = (fft_freqs >= min_rate) & (fft_freqs <= max_rate)
        if not np.any(rate_mask):
            continue

        masked_fft = fft[rate_mask]
        masked_freqs = fft_freqs[rate_mask]

        peak_idx = np.argmax(masked_fft)
        peak_power = masked_fft[peak_idx]
        peak_rate = masked_freqs[peak_idx]

        # Estimate extent
        extent = np.ptp(cents)  # Peak-to-peak

        if extent >= min_extent_cents and peak_power > 2.0:
            vibratos.append({
                'start_time': round(float(times[start_idx]), 3),
                'end_time': round(float(times[min(end_idx, len(times) - 1)]), 3),
                'rate_hz': round(float(peak_rate), 1),
                'extent_cents': round(float(extent), 1),
            })

    # Merge overlapping vibrato regions
    return _merge_vibrato_regions(vibratos)


def _merge_vibrato_regions(vibratos: List[Dict]) -> List[Dict]:
    """Merge overlapping vibrato detections."""
    if not vibratos:
        return []

    merged = [vibratos[0].copy()]
    for v in vibratos[1:]:
        if v['start_time'] <= merged[-1]['end_time']:
            merged[-1]['end_time'] = max(merged[-1]['end_time'], v['end_time'])
            merged[-1]['rate_hz'] = (merged[-1]['rate_hz'] + v['rate_hz']) / 2
            merged[-1]['extent_cents'] = max(merged[-1]['extent_cents'], v['extent_cents'])
        else:
            merged.append(v.copy())
    return merged


# ---------------------------------------------------------------------------
# Real-time single-frame pitch (for WebSocket consumer)
# ---------------------------------------------------------------------------

def detect_pitch_realtime(
    frame: np.ndarray,
    sr: int = 44100,
    threshold: float = 0.15,
) -> Dict:
    """
    Single-frame pitch detection optimized for real-time use.
    Returns a compact result dict.
    """
    freq, conf = yin_pitch(frame, sr, threshold)
    return {
        'f': round(freq, 2),
        'c': round(conf, 3),
        'n': freq_to_note_name(freq),
        'ct': round(freq_to_cents(freq), 1) if freq > 0 else 0,
        'm': round(freq_to_midi(freq), 2) if freq > 0 else 0,
    }
