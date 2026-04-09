"""
Theory App Views
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from audio.models import AudioSession, ChordEvent
from audio.serializers import ChordEventSerializer
from .models import TheoryAnalysis
from .analyzer import full_theory_analysis


@api_view(['POST'])
def analyze_theory(request):
    """
    POST /api/theory/analyze/
    Run theory analysis on a session's chord data.
    Body: { "session_id": "<uuid>" }
    """
    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'error': 'session_id required'}, status=400)

    try:
        session = AudioSession.objects.get(id=session_id)
    except AudioSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    # Get chord events
    chord_events = session.chord_events.all()
    if not chord_events.exists():
        return Response({'error': 'No chord data found for session'}, status=400)

    chords = [
        {
            'time': ce.time,
            'duration': ce.duration,
            'chord': ce.chord_symbol,
            'root': ce.root,
            'quality': ce.quality,
            'confidence': ce.confidence,
            'root_pc': _note_to_pc(ce.root),
            'roman': ce.roman_numeral,
        }
        for ce in chord_events
    ]

    # Get key from analysis
    try:
        analysis = session.analysis
        key = analysis.key
        mode = 'minor' if 'minor' in key.lower() else 'major'
    except Exception:
        key = 'C major'
        mode = 'major'

    # Run theory analysis
    result = full_theory_analysis(chords, key, mode)

    # Store
    ta = TheoryAnalysis.objects.create(
        session=session,
        key=key,
        mode=mode,
        cadences=result['cadences'],
        matched_progressions=result['matched_progressions'],
        harmonic_distribution=result['harmonic_function_distribution'],
        full_analysis=result,
    )

    return Response(result, status=201)


@api_view(['GET'])
def get_chords(request, session_id):
    """GET /api/theory/chords/<session_id>/"""
    try:
        session = AudioSession.objects.get(id=session_id)
    except AudioSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    chords = session.chord_events.all()
    return Response(ChordEventSerializer(chords, many=True).data)


@api_view(['GET'])
def get_key(request, session_id):
    """GET /api/theory/key/<session_id>/"""
    try:
        session = AudioSession.objects.get(id=session_id)
        analysis = session.analysis
        return Response({
            'key': analysis.key,
            'confidence': analysis.key_confidence,
            'scale': analysis.scale,
        })
    except AudioSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)
    except Exception:
        return Response({'error': 'No analysis found'}, status=404)


NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def _note_to_pc(note_name: str) -> int:
    """Convert note name to pitch class."""
    clean = note_name.strip().upper().replace('♯', '#').replace('♭', 'b')
    # Handle flat names
    flat_map = {'DB': 1, 'EB': 3, 'GB': 6, 'AB': 8, 'BB': 10}
    if clean in flat_map:
        return flat_map[clean]
    if clean in NOTE_NAMES:
        return NOTE_NAMES.index(clean)
    return 0
