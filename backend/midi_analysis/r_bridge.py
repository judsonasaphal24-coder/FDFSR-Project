"""
R Integration Bridge
====================
Handles communication with R scripts for MIDI analysis.
Uses subprocess for portability. Falls back to Python-based
MIDI parsing if R is not available.
"""
import json
import subprocess
import os
import logging
from typing import Dict, Optional
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)


def is_r_available() -> bool:
    """Check if R/Rscript is available on the system."""
    r_path = settings.R_SETTINGS.get('RSCRIPT_PATH', 'Rscript')
    try:
        result = subprocess.run(
            [r_path, '--version'],
            capture_output=True, text=True, timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def run_r_script(script_name: str, *args) -> Dict:
    """
    Execute an R script and parse its JSON output.

    Parameters
    ----------
    script_name : str
        Name of the R script (e.g. 'midi_parser.R')
    *args : str
        Arguments to pass to the script

    Returns
    -------
    dict : Parsed JSON output from the R script
    """
    r_path = settings.R_SETTINGS.get('RSCRIPT_PATH', 'Rscript')
    scripts_dir = settings.R_SETTINGS.get('SCRIPTS_DIR', Path(__file__).parent.parent / 'r_scripts')
    timeout = settings.R_SETTINGS.get('TIMEOUT_SECONDS', 60)

    script_path = os.path.join(scripts_dir, script_name)

    if not os.path.exists(script_path):
        raise FileNotFoundError(f"R script not found: {script_path}")

    cmd = [r_path, '--vanilla', script_path] + list(args)

    logger.info(f"Running R script: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(scripts_dir),
        )

        if result.returncode != 0:
            logger.error(f"R script error: {result.stderr}")
            raise RuntimeError(f"R script failed: {result.stderr[:500]}")

        # Parse JSON from stdout
        output = result.stdout.strip()
        if not output:
            raise RuntimeError("R script produced no output")

        return json.loads(output)

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"R script timed out after {timeout}s")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse R output: {result.stdout[:200]}")
        raise RuntimeError(f"Invalid JSON from R: {e}")


def analyze_midi_with_r(midi_path: str) -> Dict:
    """
    Run full MIDI analysis using R scripts.
    Returns structured analysis data.
    """
    if not is_r_available():
        logger.warning("R not available, falling back to Python MIDI analysis")
        return analyze_midi_with_python(midi_path)

    try:
        result = run_r_script('midi_parser.R', midi_path)
        return result
    except Exception as e:
        logger.error(f"R analysis failed: {e}, falling back to Python")
        return analyze_midi_with_python(midi_path)


# ---------------------------------------------------------------------------
# Python Fallback MIDI Analysis (using mido)
# ---------------------------------------------------------------------------

def analyze_midi_with_python(midi_path: str) -> Dict:
    """
    Fallback MIDI analysis using Python's mido library.
    Provides similar output to the R analysis.
    """
    try:
        import mido
    except ImportError:
        return {'error': 'Neither R nor mido is available for MIDI analysis'}

    mid = mido.MidiFile(midi_path)

    # Extract notes
    notes = []
    tempo = 500000  # Default 120 BPM
    time_sig = '4/4'

    for i, track in enumerate(mid.tracks):
        abs_time = 0
        active_notes = {}

        for msg in track:
            abs_time += msg.time

            if msg.type == 'set_tempo':
                tempo = msg.tempo
            elif msg.type == 'time_signature':
                time_sig = f"{msg.numerator}/{msg.denominator}"
            elif msg.type == 'note_on' and msg.velocity > 0:
                key = (msg.channel, msg.note)
                time_seconds = mido.tick2second(abs_time, mid.ticks_per_beat, tempo)
                active_notes[key] = {
                    'pitch': msg.note,
                    'velocity': msg.velocity,
                    'start_time': time_seconds,
                    'track': i,
                    'channel': msg.channel,
                }
            elif msg.type in ('note_off', 'note_on') and (
                msg.type == 'note_off' or msg.velocity == 0
            ):
                key = (msg.channel, msg.note)
                if key in active_notes:
                    note = active_notes.pop(key)
                    end_time = mido.tick2second(abs_time, mid.ticks_per_beat, tempo)
                    note['end_time'] = end_time
                    note['duration'] = end_time - note['start_time']
                    note['note_name'] = _midi_to_note_name(note['pitch'])
                    notes.append(note)

    notes.sort(key=lambda n: n['start_time'])

    bpm = round(mido.tempo2bpm(tempo), 1)
    duration = max((n['end_time'] for n in notes), default=0)

    # Key detection from note distribution
    pitch_classes = [0] * 12
    for note in notes:
        pc = note['pitch'] % 12
        pitch_classes[pc] += note['duration']

    key_result = _simple_key_detect(pitch_classes)

    # Chord detection per beat
    beat_duration = 60.0 / bpm
    chords = _detect_chords_from_notes(notes, beat_duration)

    # Roman numeral analysis
    tonic_pc = _note_name_to_pc(key_result['tonic'])
    roman = _roman_analysis(chords, tonic_pc, key_result['mode'])

    # Voice leading
    voice_leading = _analyze_voice_leading(notes)

    return {
        'source': 'python',
        'num_tracks': len(mid.tracks),
        'num_notes': len(notes),
        'duration': round(duration, 2),
        'tempo_bpm': bpm,
        'time_signature': time_sig,
        'key': key_result,
        'notes': notes[:5000],  # Limit for large files
        'chords': chords,
        'roman_numerals': roman,
        'voice_leading': voice_leading[:100],
        'pitch_class_distribution': pitch_classes,
    }


NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def _midi_to_note_name(midi_num: int) -> str:
    """Convert MIDI note to name."""
    octave = midi_num // 12 - 1
    note = NOTE_NAMES[midi_num % 12]
    return f"{note}{octave}"


def _note_name_to_pc(name: str) -> int:
    """Convert note name to pitch class."""
    clean = name.strip().replace('♯', '#')
    if clean in NOTE_NAMES:
        return NOTE_NAMES.index(clean)
    return 0


def _simple_key_detect(pitch_classes: list) -> Dict:
    """Simple key detection from pitch class distribution."""
    import numpy as np

    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                     2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                     2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

    pc = np.array(pitch_classes, dtype=float)
    total = np.sum(pc)
    if total > 0:
        pc = pc / total

    best_corr = -1
    best_key = {'tonic': 'C', 'mode': 'major', 'key': 'C major', 'confidence': 0}

    for root in range(12):
        maj = np.roll(major_profile, root)
        corr_maj = float(np.corrcoef(pc, maj)[0, 1])
        if corr_maj > best_corr:
            best_corr = corr_maj
            best_key = {
                'tonic': NOTE_NAMES[root],
                'mode': 'major',
                'key': f"{NOTE_NAMES[root]} major",
                'confidence': round(max(0, corr_maj), 3),
            }

        mn = np.roll(minor_profile, root)
        corr_min = float(np.corrcoef(pc, mn)[0, 1])
        if corr_min > best_corr:
            best_corr = corr_min
            best_key = {
                'tonic': NOTE_NAMES[root],
                'mode': 'minor',
                'key': f"{NOTE_NAMES[root]} minor",
                'confidence': round(max(0, corr_min), 3),
            }

    return best_key


def _detect_chords_from_notes(notes: list, beat_duration: float) -> list:
    """Detect chords per beat from MIDI notes."""
    if not notes:
        return []

    max_time = max(n['end_time'] for n in notes)
    chords = []

    t = 0.0
    while t < max_time:
        # Collect notes sounding during this beat
        active = [
            n for n in notes
            if n['start_time'] <= t + beat_duration and n['end_time'] > t
        ]
        if active:
            pcs = set(n['pitch'] % 12 for n in active)
            chord = _identify_chord(pcs)
            chord['time'] = round(t, 3)
            chord['duration'] = round(beat_duration, 3)
            chords.append(chord)
        t += beat_duration

    return chords


def _identify_chord(pitch_classes: set) -> Dict:
    """Identify chord from a set of pitch classes."""
    templates = {
        'maj': {0, 4, 7}, 'min': {0, 3, 7}, 'dim': {0, 3, 6},
        'aug': {0, 4, 8}, '7': {0, 4, 7, 10}, 'maj7': {0, 4, 7, 11},
        'min7': {0, 3, 7, 10},
    }

    best_match = {'chord': 'N/C', 'root': '--', 'quality': '--', 'root_pc': -1}
    best_score = 0

    for root in range(12):
        shifted = {(pc - root) % 12 for pc in pitch_classes}
        for quality, template in templates.items():
            overlap = len(shifted & template)
            coverage = overlap / len(template) if template else 0
            if coverage > best_score:
                best_score = coverage
                root_name = NOTE_NAMES[root]
                display = root_name if quality == 'maj' else f"{root_name}{'' if quality == 'maj' else quality}"
                if quality == 'min':
                    display = f"{root_name}m"
                best_match = {
                    'chord': display,
                    'root': root_name,
                    'quality': quality,
                    'confidence': round(coverage, 3),
                    'root_pc': root,
                }

    return best_match


def _roman_analysis(chords: list, tonic_pc: int, mode: str) -> list:
    """Add Roman numeral labels to chords."""
    major_map = {0: 'I', 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi', 11: 'vii°'}
    minor_map = {0: 'i', 2: 'ii°', 3: 'III', 5: 'iv', 7: 'V', 8: 'VI', 10: 'VII'}
    rn_map = major_map if mode == 'major' else minor_map

    result = []
    for ch in chords:
        entry = dict(ch)
        root_pc = ch.get('root_pc', -1)
        if root_pc >= 0:
            degree = (root_pc - tonic_pc) % 12
            entry['roman'] = rn_map.get(degree, f'#{degree}')
        else:
            entry['roman'] = '?'
        result.append(entry)

    return result


def _analyze_voice_leading(notes: list) -> list:
    """Analyze voice leading patterns between consecutive chords."""
    if len(notes) < 2:
        return []

    voice_leading = []
    for i in range(1, min(len(notes), 500)):
        interval = notes[i]['pitch'] - notes[i - 1]['pitch']
        motion_type = 'oblique'
        if interval == 0:
            motion_type = 'static'
        elif abs(interval) <= 2:
            motion_type = 'step'
        elif abs(interval) <= 4:
            motion_type = 'small_leap'
        else:
            motion_type = 'leap'

        voice_leading.append({
            'from': notes[i - 1]['note_name'],
            'to': notes[i]['note_name'],
            'interval': interval,
            'semitones': abs(interval),
            'direction': 'up' if interval > 0 else ('down' if interval < 0 else 'same'),
            'motion_type': motion_type,
            'time': notes[i]['start_time'],
        })

    return voice_leading
