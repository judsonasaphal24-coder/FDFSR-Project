"""
Audio Utilities
===============
Foundational helpers for audio loading, frequency/note conversion,
windowing, and signal processing primitives.
"""
import numpy as np
from typing import Tuple, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
A4_FREQ = 440.0
A4_MIDI = 69

# Enharmonic display names for flat keys
FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def freq_to_midi(frequency: float) -> float:
    """Convert frequency in Hz to MIDI note number (float, for cents)."""
    if frequency <= 0:
        return 0.0
    return 12.0 * np.log2(frequency / A4_FREQ) + A4_MIDI


def midi_to_freq(midi_note: float) -> float:
    """Convert MIDI note number to frequency in Hz."""
    return A4_FREQ * (2.0 ** ((midi_note - A4_MIDI) / 12.0))


def freq_to_note_name(frequency: float, use_flats: bool = False) -> str:
    """
    Convert frequency to note name with octave (e.g., 'A4', 'C#3').
    Returns '--' for invalid/zero frequency.
    """
    if frequency <= 0:
        return '--'
    midi = freq_to_midi(frequency)
    note_index = int(round(midi)) % 12
    octave = int(round(midi)) // 12 - 1
    names = FLAT_NAMES if use_flats else NOTE_NAMES
    return f"{names[note_index]}{octave}"


def freq_to_cents(frequency: float) -> float:
    """
    Calculate cents deviation from the nearest semitone.
    Returns value in range [-50, +50].
    """
    if frequency <= 0:
        return 0.0
    midi = freq_to_midi(frequency)
    nearest = round(midi)
    return (midi - nearest) * 100.0


def freq_to_pitch_class(frequency: float) -> int:
    """Convert frequency to pitch class (0=C, 1=C#, ..., 11=B)."""
    if frequency <= 0:
        return -1
    midi = int(round(freq_to_midi(frequency)))
    return midi % 12


def hz_to_mel(frequency: float) -> float:
    """Convert Hz to Mel scale."""
    return 2595.0 * np.log10(1.0 + frequency / 700.0)


def mel_to_hz(mel: float) -> float:
    """Convert Mel scale to Hz."""
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


# ---------------------------------------------------------------------------
# Audio loading & normalization
# ---------------------------------------------------------------------------
def load_audio(filepath: str, sr: int = 44100, mono: bool = True) -> Tuple[np.ndarray, int]:
    """
    Load audio file using librosa, return (samples, sample_rate).
    Falls back to scipy if librosa unavailable.
    """
    try:
        import librosa
        y, sr_out = librosa.load(filepath, sr=sr, mono=mono)
        return y, sr_out
    except ImportError:
        from scipy.io import wavfile
        sr_out, data = wavfile.read(filepath)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        if mono and data.ndim > 1:
            data = data.mean(axis=1)
        return data, sr_out


def normalize_audio(signal: np.ndarray) -> np.ndarray:
    """Normalize audio signal to [-1, 1] range."""
    peak = np.max(np.abs(signal))
    if peak > 0:
        return signal / peak
    return signal


def apply_window(signal: np.ndarray, window_type: str = 'hann') -> np.ndarray:
    """Apply a window function to a signal frame."""
    n = len(signal)
    if window_type == 'hann':
        window = np.hanning(n)
    elif window_type == 'hamming':
        window = np.hamming(n)
    elif window_type == 'blackman':
        window = np.blackman(n)
    else:
        window = np.ones(n)
    return signal * window


def frame_signal(signal: np.ndarray, frame_size: int, hop_size: int) -> np.ndarray:
    """
    Split signal into overlapping frames.
    Returns array of shape (num_frames, frame_size).
    """
    num_frames = 1 + (len(signal) - frame_size) // hop_size
    indices = np.arange(frame_size)[np.newaxis, :] + np.arange(num_frames)[:, np.newaxis] * hop_size
    return signal[indices]


def compute_rms(signal: np.ndarray) -> float:
    """Compute root mean square energy of a signal."""
    return float(np.sqrt(np.mean(signal ** 2)))


def compute_stft(
    signal: np.ndarray,
    n_fft: int = 2048,
    hop_length: int = 512,
    window: str = 'hann',
) -> np.ndarray:
    """
    Compute Short-Time Fourier Transform.
    Returns complex spectrogram of shape (n_fft//2 + 1, num_frames).
    """
    try:
        import librosa
        return librosa.stft(signal, n_fft=n_fft, hop_length=hop_length, window=window)
    except ImportError:
        frames = frame_signal(signal, n_fft, hop_length)
        win = np.hanning(n_fft) if window == 'hann' else np.ones(n_fft)
        windowed = frames * win
        return np.fft.rfft(windowed, axis=1).T


def compute_chroma(
    signal: np.ndarray,
    sr: int = 44100,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> np.ndarray:
    """
    Compute chromagram (12-dimensional pitch class energy over time).
    Returns array of shape (12, num_frames).
    """
    try:
        import librosa
        return librosa.feature.chroma_stft(y=signal, sr=sr, n_fft=n_fft, hop_length=hop_length)
    except ImportError:
        # Manual chroma via STFT
        S = np.abs(compute_stft(signal, n_fft, hop_length)) ** 2
        freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
        chroma = np.zeros((12, S.shape[1]))
        for i, f in enumerate(freqs):
            if f > 0:
                pc = freq_to_pitch_class(f)
                if pc >= 0:
                    chroma[pc] += S[i]
        # Normalize each frame
        norms = np.max(chroma, axis=0, keepdims=True)
        norms[norms == 0] = 1
        return chroma / norms
