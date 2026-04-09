"""
Audio App Serializers
=====================
DRF serializers for audio models and analysis payloads.
"""
from rest_framework import serializers
from .models import AudioSession, PitchData, NoteSegment, ChordEvent, AnalysisResult


class PitchDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = PitchData
        fields = ['time', 'frequency', 'confidence', 'midi_note', 'note_name', 'cents']


class NoteSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteSegment
        fields = [
            'start_time', 'end_time', 'duration', 'frequency',
            'note_name', 'midi_note', 'cents', 'confidence',
            'pitch_drift', 'has_vibrato', 'velocity_estimate',
        ]


class ChordEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChordEvent
        fields = [
            'time', 'duration', 'chord_symbol', 'root', 'quality',
            'confidence', 'roman_numeral', 'harmonic_function',
        ]


class AnalysisResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisResult
        fields = [
            'key', 'key_confidence', 'scale', 'tempo_bpm',
            'num_notes', 'num_phrases', 'analysis_json', 'created_at',
        ]


class AudioSessionSerializer(serializers.ModelSerializer):
    analysis = AnalysisResultSerializer(read_only=True)

    class Meta:
        model = AudioSession
        fields = [
            'id', 'name', 'created_at', 'updated_at', 'sample_rate',
            'duration', 'audio_file', 'status', 'analysis',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'status']


class AudioSessionDetailSerializer(serializers.ModelSerializer):
    """Full session detail including all analysis data."""
    analysis = AnalysisResultSerializer(read_only=True)
    pitch_data = PitchDataSerializer(many=True, read_only=True)
    note_segments = NoteSegmentSerializer(many=True, read_only=True)
    chord_events = ChordEventSerializer(many=True, read_only=True)

    class Meta:
        model = AudioSession
        fields = [
            'id', 'name', 'created_at', 'updated_at', 'sample_rate',
            'duration', 'audio_file', 'status', 'analysis',
            'pitch_data', 'note_segments', 'chord_events',
        ]


class AudioUploadSerializer(serializers.Serializer):
    """Serializer for audio file upload."""
    audio_file = serializers.FileField()
    name = serializers.CharField(max_length=255, required=False, default='Uploaded Audio')

    def validate_audio_file(self, value):
        max_size = 100 * 1024 * 1024  # 100 MB
        if value.size > max_size:
            raise serializers.ValidationError("File too large. Maximum 100MB.")
        valid_types = [
            'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3',
            'audio/flac', 'audio/ogg', 'audio/aiff', 'audio/x-aiff',
        ]
        content_type = getattr(value, 'content_type', '')
        # Allow if content_type is set and valid, or just accept by extension
        if content_type and content_type not in valid_types:
            ext = value.name.split('.')[-1].lower() if '.' in value.name else ''
            if ext not in ['wav', 'mp3', 'flac', 'ogg', 'aiff']:
                raise serializers.ValidationError("Unsupported audio format.")
        return value
