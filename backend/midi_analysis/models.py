"""
MIDI Analysis Models
"""
import uuid
from django.db import models


class MidiFile(models.Model):
    """Uploaded MIDI file."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default='Untitled MIDI')
    file = models.FileField(upload_to='midi/')
    num_tracks = models.IntegerField(default=0)
    duration = models.FloatField(null=True, blank=True)
    tempo_bpm = models.FloatField(null=True, blank=True)
    time_signature = models.CharField(max_length=10, blank=True, default='4/4')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('uploaded', 'Uploaded'),
            ('analyzing', 'Analyzing'),
            ('completed', 'Completed'),
            ('error', 'Error'),
        ],
        default='uploaded',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class MidiNote(models.Model):
    """Individual MIDI note event."""
    midi_file = models.ForeignKey(
        MidiFile, on_delete=models.CASCADE, related_name='notes'
    )
    track = models.IntegerField(default=0)
    channel = models.IntegerField(default=0)
    pitch = models.IntegerField()       # MIDI note number
    velocity = models.IntegerField()
    start_time = models.FloatField()    # seconds
    end_time = models.FloatField()
    duration = models.FloatField()
    note_name = models.CharField(max_length=10)

    class Meta:
        ordering = ['start_time']


class MidiAnalysisResult(models.Model):
    """Complete analysis of a MIDI file (from R or Python)."""
    midi_file = models.OneToOneField(
        MidiFile, on_delete=models.CASCADE, related_name='analysis'
    )
    key = models.CharField(max_length=20, blank=True)
    key_confidence = models.FloatField(default=0.0)
    chord_progression = models.JSONField(default=list)
    roman_numerals = models.JSONField(default=list)
    harmonic_functions = models.JSONField(default=list)
    voice_leading = models.JSONField(default=list)
    analysis_source = models.CharField(
        max_length=10,
        choices=[('r', 'R Language'), ('python', 'Python')],
        default='python',
    )
    full_analysis = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"MIDI Analysis: {self.midi_file.name} — {self.key}"
