"""
MIDI Analysis Views
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from .models import MidiFile, MidiNote, MidiAnalysisResult
from .r_bridge import analyze_midi_with_r


@api_view(['POST'])
def upload_midi(request):
    """
    POST /api/midi/upload/
    Upload and analyze a MIDI file.
    """
    if 'file' not in request.FILES:
        return Response({'error': 'No MIDI file provided'}, status=400)

    midi_file_data = request.FILES['file']
    name = request.data.get('name', midi_file_data.name)

    # Validate extension
    if not midi_file_data.name.lower().endswith(('.mid', '.midi')):
        return Response({'error': 'File must be .mid or .midi'}, status=400)

    midi_obj = MidiFile.objects.create(
        name=name,
        file=midi_file_data,
        status='analyzing',
    )

    try:
        result = analyze_midi_with_r(midi_obj.file.path)

        # Store metadata
        midi_obj.num_tracks = result.get('num_tracks', 0)
        midi_obj.duration = result.get('duration')
        midi_obj.tempo_bpm = result.get('tempo_bpm')
        midi_obj.time_signature = result.get('time_signature', '4/4')
        midi_obj.status = 'completed'
        midi_obj.save()

        # Store individual notes
        notes_data = result.get('notes', [])
        note_objects = []
        for note in notes_data[:10000]:
            note_objects.append(MidiNote(
                midi_file=midi_obj,
                track=note.get('track', 0),
                channel=note.get('channel', 0),
                pitch=note.get('pitch', 0),
                velocity=note.get('velocity', 0),
                start_time=note.get('start_time', 0),
                end_time=note.get('end_time', 0),
                duration=note.get('duration', 0),
                note_name=note.get('note_name', '--'),
            ))
        MidiNote.objects.bulk_create(note_objects)

        # Store analysis
        key_data = result.get('key', {})
        MidiAnalysisResult.objects.create(
            midi_file=midi_obj,
            key=key_data.get('key', ''),
            key_confidence=key_data.get('confidence', 0),
            chord_progression=result.get('chords', []),
            roman_numerals=result.get('roman_numerals', []),
            harmonic_functions=result.get('harmonic_functions', []),
            voice_leading=result.get('voice_leading', []),
            analysis_source=result.get('source', 'python'),
            full_analysis=result,
        )

        return Response({
            'id': str(midi_obj.id),
            'name': midi_obj.name,
            'status': 'completed',
            'analysis': result,
        }, status=201)

    except Exception as e:
        midi_obj.status = 'error'
        midi_obj.save()
        error_msg = str(e) or e.__class__.__name__
        return Response({'error': error_msg}, status=500)


@api_view(['GET'])
def get_midi_analysis(request, midi_id):
    """GET /api/midi/analysis/<midi_id>/"""
    try:
        midi_obj = MidiFile.objects.get(id=midi_id)
        analysis = midi_obj.analysis
        return Response(analysis.full_analysis)
    except MidiFile.DoesNotExist:
        return Response({'error': 'MIDI file not found'}, status=404)
    except MidiAnalysisResult.DoesNotExist:
        return Response({'error': 'No analysis found'}, status=404)


@api_view(['GET'])
def get_piano_roll(request, midi_id):
    """
    GET /api/midi/piano-roll/<midi_id>/
    Return note data formatted for piano roll display.
    """
    try:
        midi_obj = MidiFile.objects.get(id=midi_id)
    except MidiFile.DoesNotExist:
        return Response({'error': 'MIDI file not found'}, status=404)

    notes = midi_obj.notes.all().values(
        'pitch', 'velocity', 'start_time', 'end_time',
        'duration', 'note_name', 'track', 'channel',
    )

    return Response({
        'midi_id': str(midi_obj.id),
        'name': midi_obj.name,
        'duration': midi_obj.duration,
        'tempo_bpm': midi_obj.tempo_bpm,
        'notes': list(notes),
    })


@api_view(['GET'])
def list_midi_files(request):
    """GET /api/midi/files/"""
    files = MidiFile.objects.all().values(
        'id', 'name', 'num_tracks', 'duration',
        'tempo_bpm', 'status', 'created_at',
    )
    return Response(list(files))
