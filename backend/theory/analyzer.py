"""
Music Theory Engine — Analyzer
==============================
Advanced music theory analysis: harmonic functions, cadence detection,
voice leading patterns, and progression classification.
"""
from typing import List, Dict, Optional
from dsp.audio_utils import NOTE_NAMES


# ---------------------------------------------------------------------------
# Harmonic Function Labeling
# ---------------------------------------------------------------------------

FUNCTION_MAP_MAJOR = {
    0: 'T',   # I — Tonic
    1: None,
    2: 'S',   # II — Subdominant (pre-dominant)
    3: None,
    4: 'T',   # III — Tonic prolongation
    5: 'S',   # IV — Subdominant
    6: None,
    7: 'D',   # V — Dominant
    8: None,
    9: 'T',   # VI — Tonic substitute
    10: None,
    11: 'D',  # VII — Dominant function (leading tone)
}

FUNCTION_MAP_MINOR = {
    0: 'T',   # i
    1: None,
    2: 'S',   # ii°
    3: 'T',   # III
    4: None,
    5: 'S',   # iv
    6: None,
    7: 'D',   # V (or v)
    8: 'S',   # VI
    9: None,
    10: 'D',  # VII (subtonic, dominant)
    11: 'D',  # vii° (leading tone)
}


def label_harmonic_functions(
    chords: List[Dict],
    tonic: str,
    mode: str = 'major',
) -> List[Dict]:
    """
    Label each chord with its harmonic function (T/S/D).
    """
    tonic_pc = NOTE_NAMES.index(tonic) if tonic in NOTE_NAMES else 0
    func_map = FUNCTION_MAP_MAJOR if mode == 'major' else FUNCTION_MAP_MINOR

    result = []
    for chord in chords:
        entry = dict(chord)
        root_pc = chord.get('root_pc', -1)
        if root_pc >= 0:
            degree = (root_pc - tonic_pc) % 12
            fn = func_map.get(degree)
            entry['harmonic_function'] = fn or 'Chr'  # Chromatic
            entry['scale_degree'] = degree
        else:
            entry['harmonic_function'] = '?'
            entry['scale_degree'] = -1
        result.append(entry)

    return result


# ---------------------------------------------------------------------------
# Cadence Detection
# ---------------------------------------------------------------------------

CADENCE_PATTERNS = {
    'PAC': [('D', 'T')],         # Perfect Authentic: V → I
    'IAC': [('D', 'T')],         # Imperfect Authentic (same pattern, weaker)
    'HC': [('T', 'D'), ('S', 'D')],  # Half Cadence: → V
    'DC': [('D', 'S')],          # Deceptive: V → vi
    'PC': [('S', 'T')],          # Plagal: IV → I
}


def detect_cadences(
    chords: List[Dict],
    tonic: str,
    mode: str = 'major',
) -> List[Dict]:
    """
    Detect cadences in a chord progression.
    """
    labeled = label_harmonic_functions(chords, tonic, mode)
    cadences = []

    for i in range(1, len(labeled)):
        prev_fn = labeled[i - 1].get('harmonic_function', '?')
        curr_fn = labeled[i].get('harmonic_function', '?')

        for cadence_name, patterns in CADENCE_PATTERNS.items():
            for pattern in patterns:
                if prev_fn == pattern[0] and curr_fn == pattern[1]:
                    cadences.append({
                        'type': cadence_name,
                        'time': labeled[i]['time'],
                        'chords': [
                            labeled[i - 1].get('chord', '?'),
                            labeled[i].get('chord', '?'),
                        ],
                        'roman': [
                            labeled[i - 1].get('roman', '?'),
                            labeled[i].get('roman', '?'),
                        ],
                    })

    return cadences


# ---------------------------------------------------------------------------
# Progression Classification
# ---------------------------------------------------------------------------

COMMON_PROGRESSIONS = {
    'I-IV-V-I': {
        'degrees': [0, 5, 7, 0],
        'name': 'Classic Cadential',
        'style': 'Classical, Folk, Country',
    },
    'I-V-vi-IV': {
        'degrees': [0, 7, 9, 5],
        'name': 'Pop Progression',
        'style': 'Pop, Rock (very common)',
    },
    'I-vi-IV-V': {
        'degrees': [0, 9, 5, 7],
        'name': "'50s Progression",
        'style': "Doo-wop, '50s Rock",
    },
    'ii-V-I': {
        'degrees': [2, 7, 0],
        'name': 'Jazz ii-V-I',
        'style': 'Jazz, Bossa Nova',
    },
    'I-IV-vi-V': {
        'degrees': [0, 5, 9, 7],
        'name': 'Axis Progression',
        'style': 'Modern Pop',
    },
    'vi-IV-I-V': {
        'degrees': [9, 5, 0, 7],
        'name': 'Minor Pop',
        'style': 'Emo, Alternative',
    },
    'I-iii-IV-V': {
        'degrees': [0, 4, 5, 7],
        'name': 'Classic Major',
        'style': 'Traditional',
    },
    'i-bVI-bIII-bVII': {
        'degrees': [0, 8, 3, 10],
        'name': 'Andalusian Cadence',
        'style': 'Flamenco, Minor key',
    },
    'I-V-vi-iii-IV-I-IV-V': {
        'degrees': [0, 7, 9, 4, 5, 0, 5, 7],
        'name': "Pachelbel's Canon",
        'style': 'Baroque, Wedding music',
    },
    'I-bVII-IV-I': {
        'degrees': [0, 10, 5, 0],
        'name': 'Mixolydian Vamp',
        'style': 'Rock, Blues Rock',
    },
}


def classify_progression(
    chords: List[Dict],
    tonic: str,
) -> List[Dict]:
    """
    Try to match the chord progression against known patterns.
    Returns matched patterns with confidence.
    """
    tonic_pc = NOTE_NAMES.index(tonic) if tonic in NOTE_NAMES else 0

    # Extract scale degrees
    degrees = []
    for chord in chords:
        root_pc = chord.get('root_pc', -1)
        if root_pc >= 0:
            degree = (root_pc - tonic_pc) % 12
            degrees.append(degree)

    matches = []
    for prog_name, prog_info in COMMON_PROGRESSIONS.items():
        pattern = prog_info['degrees']
        pattern_len = len(pattern)

        if len(degrees) < pattern_len:
            continue

        # Sliding window match
        match_count = 0
        total_windows = len(degrees) - pattern_len + 1

        for i in range(total_windows):
            window = degrees[i:i + pattern_len]
            if window == pattern:
                match_count += 1

        if match_count > 0:
            confidence = match_count / total_windows
            matches.append({
                'pattern': prog_name,
                'name': prog_info['name'],
                'style': prog_info['style'],
                'occurrences': match_count,
                'confidence': round(confidence, 3),
            })

    matches.sort(key=lambda x: x['confidence'], reverse=True)
    return matches


# ---------------------------------------------------------------------------
# Full Theory Analysis
# ---------------------------------------------------------------------------

def full_theory_analysis(
    chords: List[Dict],
    key: str,
    mode: str = 'major',
) -> Dict:
    """
    Run complete music theory analysis on a chord progression.
    """
    tonic = key.split()[0] if ' ' in key else key

    # Harmonic functions
    labeled = label_harmonic_functions(chords, tonic, mode)

    # Cadences
    cadences = detect_cadences(chords, tonic, mode)

    # Progression patterns
    patterns = classify_progression(chords, tonic)

    # Function distribution
    func_counts = {'T': 0, 'S': 0, 'D': 0, 'Chr': 0}
    for ch in labeled:
        fn = ch.get('harmonic_function', '?')
        if fn in func_counts:
            func_counts[fn] += 1

    total = sum(func_counts.values())
    func_distribution = {
        k: round(v / total, 3) if total > 0 else 0
        for k, v in func_counts.items()
    }

    return {
        'key': key,
        'mode': mode,
        'labeled_chords': labeled,
        'cadences': cadences,
        'matched_progressions': patterns,
        'harmonic_function_distribution': func_distribution,
        'total_chords': len(chords),
        'total_cadences': len(cadences),
    }
