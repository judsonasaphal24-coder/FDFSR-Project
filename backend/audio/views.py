"""
Audio App Views
===============
REST API endpoints for audio upload, analysis, and data retrieval.
"""
import json
import numpy as np
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import AudioSession, PitchData, NoteSegment, ChordEvent, AnalysisResult
from .serializers import (
    AudioSessionSerializer, AudioSessionDetailSerializer,
    AudioUploadSerializer, PitchDataSerializer,
    NoteSegmentSerializer, ChordEventSerializer,
    AnalysisResultSerializer,
)


class AudioSessionViewSet(viewsets.ModelViewSet):
    """
    CRUD for audio sessions.
    GET /api/audio/sessions/         — List all sessions
    POST /api/audio/sessions/        — Create session
    GET /api/audio/sessions/<id>/    — Session detail with all data
    DELETE /api/audio/sessions/<id>/ — Delete session
    """
    queryset = AudioSession.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AudioSessionDetailSerializer
        return AudioSessionSerializer

    @action(detail=True, methods=['get'])
    def pitch(self, request, pk=None):
        """GET /api/audio/sessions/<id>/pitch/ — Pitch data only."""
        session = self.get_object()
        data = session.pitch_data.all()
        serializer = PitchDataSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def notes(self, request, pk=None):
        """GET /api/audio/sessions/<id>/notes/ — Note segments."""
        session = self.get_object()
        data = session.note_segments.all()
        serializer = NoteSegmentSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def chords(self, request, pk=None):
        """GET /api/audio/sessions/<id>/chords/ — Chord events."""
        session = self.get_object()
        data = session.chord_events.all()
        serializer = ChordEventSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """GET /api/audio/sessions/<id>/export/ — Export full analysis as JSON."""
        session = self.get_object()
        export_data = {
            'session': AudioSessionSerializer(session).data,
            'pitch_track': PitchDataSerializer(
                session.pitch_data.all(), many=True
            ).data,
            'notes': NoteSegmentSerializer(
                session.note_segments.all(), many=True
            ).data,
            'chords': ChordEventSerializer(
                session.chord_events.all(), many=True
            ).data,
        }
        try:
            analysis = session.analysis
            export_data['analysis'] = AnalysisResultSerializer(analysis).data
        except AnalysisResult.DoesNotExist:
            export_data['analysis'] = None

        return Response(export_data)


@api_view(['POST'])
def upload_and_analyze(request):
    """
    POST /api/audio/upload/
    Upload an audio file and trigger full analysis pipeline.
    """
    serializer = AudioUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    audio_file = serializer.validated_data['audio_file']
    name = serializer.validated_data.get('name', 'Uploaded Audio')

    # Create session
    session = AudioSession.objects.create(
        name=name,
        audio_file=audio_file,
        status='analyzing',
    )

    # Run analysis pipeline
    try:
        _run_analysis_pipeline(session)
        session.status = 'completed'
        session.save()
    except Exception as e:
        session.status = 'error'
        session.save()
        return Response(
            {'error': str(e), 'session_id': str(session.id)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        AudioSessionDetailSerializer(session).data,
        status=status.HTTP_201_CREATED,
    )


def _run_analysis_pipeline(session: AudioSession):
    """
    Full audio analysis pipeline:
    1. Load audio
    2. Detect pitch track
    3. Detect onsets
    4. Segment into notes
    5. Detect key
    6. Detect chords
    7. Store all results
    """
    from dsp.audio_utils import load_audio, compute_chroma
    from dsp.pitch_detection import detect_pitch_track, detect_vibrato
    from dsp.onset_detection import detect_onsets
    from dsp.segmentation import segment_notes, detect_phrases
    from dsp.key_detection import detect_key_from_pitches, detect_scale
    from dsp.chord_detection import detect_chords, roman_numeral_analysis

    audio_settings = settings.AUDIO_SETTINGS
    sr = audio_settings['SAMPLE_RATE']
    frame_size = audio_settings['CHUNK_SIZE']
    hop_size = audio_settings['HOP_SIZE']

    # 1. Load audio
    filepath = session.audio_file.path
    signal, actual_sr = load_audio(filepath, sr=sr, mono=True)
    session.duration = len(signal) / actual_sr
    session.sample_rate = actual_sr
    session.save()

    # 2. Pitch detection
    pitch_track = detect_pitch_track(signal, actual_sr, frame_size, hop_size)

    # Store pitch data (subsample for large files)
    max_pitch_points = 10000
    step = max(1, len(pitch_track) // max_pitch_points)
    pitch_objects = []
    for i, pt in enumerate(pitch_track):
        if i % step == 0:
            pitch_objects.append(PitchData(
                session=session,
                time=pt['time'],
                frequency=pt['frequency'],
                confidence=pt['confidence'],
                midi_note=pt['midi'],
                note_name=pt['note'],
                cents=pt['cents'],
            ))
    PitchData.objects.bulk_create(pitch_objects)

    # 3. Onset detection
    onsets = detect_onsets(signal, actual_sr)

    # 4. Note segmentation
    notes = segment_notes(pitch_track, onsets)

    note_objects = []
    for note in notes:
        note_objects.append(NoteSegment(
            session=session,
            start_time=note['start_time'],
            end_time=note['end_time'],
            duration=note['duration'],
            frequency=note['frequency'],
            note_name=note['note'],
            midi_note=note['midi'],
            cents=note['cents'],
            confidence=note['confidence'],
            pitch_drift=note['pitch_drift'],
            has_vibrato=note['vibrato'],
            velocity_estimate=note['velocity_estimate'],
        ))
    NoteSegment.objects.bulk_create(note_objects)

    # 5. Key detection
    key_result = detect_key_from_pitches(pitch_track)
    tonic = key_result['tonic']
    mode = key_result['mode']

    # Scale detection
    chroma_total = np.zeros(12)
    for pt in pitch_track:
        if pt['frequency'] > 0:
            from dsp.audio_utils import freq_to_pitch_class
            pc = freq_to_pitch_class(pt['frequency'])
            if 0 <= pc < 12:
                chroma_total[pc] += pt['confidence']
    total = np.sum(chroma_total)
    if total > 0:
        chroma_total /= total

    from dsp.audio_utils import NOTE_NAMES
    tonic_pc = NOTE_NAMES.index(tonic) if tonic in NOTE_NAMES else 0
    scales = detect_scale(chroma_total, tonic_pc)
    best_scale = scales[0]['label'] if scales else ''

    # 6. Chord detection
    chords = detect_chords(signal, actual_sr)
    chords_with_roman = roman_numeral_analysis(chords, tonic, mode)

    chord_objects = []
    for ch in chords_with_roman:
        chord_objects.append(ChordEvent(
            session=session,
            time=ch['time'],
            duration=ch.get('duration', 0.5),
            chord_symbol=ch['chord'],
            root=ch['root'],
            quality=ch['quality'],
            confidence=ch['confidence'],
            roman_numeral=ch.get('roman', ''),
            harmonic_function=ch.get('function', ''),
        ))
    ChordEvent.objects.bulk_create(chord_objects)

    # 7. Phrases
    phrases = detect_phrases(notes)

    # 8. Vibrato analysis
    vibratos = detect_vibrato(pitch_track)

    # 9. Store analysis summary
    AnalysisResult.objects.create(
        session=session,
        key=key_result['key'],
        key_confidence=key_result['confidence'],
        scale=best_scale,
        num_notes=len(notes),
        num_phrases=len(phrases),
        analysis_json={
            'key': key_result,
            'scale': scales[:5] if scales else [],
            'phrases': [
                {
                    'start': p['start_time'],
                    'end': p['end_time'],
                    'notes': p['num_notes'],
                    'range': p['pitch_range'],
                }
                for p in phrases
            ],
            'vibratos': vibratos,
            'statistics': {
                'total_notes': len(notes),
                'total_phrases': len(phrases),
                'total_chords': len(chords_with_roman),
                'duration': session.duration,
                'avg_confidence': round(
                    float(np.mean([pt['confidence'] for pt in pitch_track if pt['confidence'] > 0])),
                    3,
                ) if pitch_track else 0,
            },
        },
    )
