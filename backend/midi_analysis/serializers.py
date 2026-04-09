"""
MIDI Analysis Serializers
"""
from rest_framework import serializers
from .models import MidiFile, MidiNote, MidiAnalysisResult


class MidiNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MidiNote
        fields = [
            'track', 'channel', 'pitch', 'velocity',
            'start_time', 'end_time', 'duration', 'note_name',
        ]


class MidiAnalysisResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = MidiAnalysisResult
        fields = '__all__'


class MidiFileSerializer(serializers.ModelSerializer):
    analysis = MidiAnalysisResultSerializer(read_only=True)

    class Meta:
        model = MidiFile
        fields = [
            'id', 'name', 'file', 'num_tracks', 'duration',
            'tempo_bpm', 'time_signature', 'status', 'created_at', 'analysis',
        ]
