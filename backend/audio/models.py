"""
Audio App Models
================
Database models for audio sessions, analysis results,
and pitch/chord data storage.
"""
import uuid
from django.db import models


class AudioSession(models.Model):
    """A recording or analysis session."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default='Untitled Session')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sample_rate = models.IntegerField(default=44100)
    duration = models.FloatField(null=True, blank=True)  # seconds
    audio_file = models.FileField(upload_to='audio/', null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('recording', 'Recording'),
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
        return f"{self.name} ({self.status})"


class PitchData(models.Model):
    """Frame-by-frame pitch detection data for a session."""
    session = models.ForeignKey(
        AudioSession, on_delete=models.CASCADE, related_name='pitch_data'
    )
    time = models.FloatField()          # Time in seconds
    frequency = models.FloatField()     # Hz
    confidence = models.FloatField()    # 0-1
    midi_note = models.FloatField()     # MIDI note number
    note_name = models.CharField(max_length=10)  # e.g. "A4"
    cents = models.FloatField()         # Deviation from nearest semitone

    class Meta:
        ordering = ['time']
        indexes = [
            models.Index(fields=['session', 'time']),
        ]


class NoteSegment(models.Model):
    """Detected note segments with timing and pitch statistics."""
    session = models.ForeignKey(
        AudioSession, on_delete=models.CASCADE, related_name='note_segments'
    )
    start_time = models.FloatField()
    end_time = models.FloatField()
    duration = models.FloatField()
    frequency = models.FloatField()
    note_name = models.CharField(max_length=10)
    midi_note = models.FloatField()
    cents = models.FloatField()
    confidence = models.FloatField()
    pitch_drift = models.FloatField(default=0.0)
    has_vibrato = models.BooleanField(default=False)
    velocity_estimate = models.FloatField(default=0.5)

    class Meta:
        ordering = ['start_time']


class ChordEvent(models.Model):
    """Detected chord at a specific time."""
    session = models.ForeignKey(
        AudioSession, on_delete=models.CASCADE, related_name='chord_events'
    )
    time = models.FloatField()
    duration = models.FloatField()
    chord_symbol = models.CharField(max_length=20)
    root = models.CharField(max_length=5)
    quality = models.CharField(max_length=20)
    confidence = models.FloatField()
    roman_numeral = models.CharField(max_length=10, blank=True, default='')
    harmonic_function = models.CharField(max_length=20, blank=True, default='')

    class Meta:
        ordering = ['time']


class AnalysisResult(models.Model):
    """Complete analysis result for a session."""
    session = models.OneToOneField(
        AudioSession, on_delete=models.CASCADE, related_name='analysis'
    )
    key = models.CharField(max_length=20, blank=True)
    key_confidence = models.FloatField(default=0.0)
    scale = models.CharField(max_length=50, blank=True)
    tempo_bpm = models.FloatField(null=True, blank=True)
    num_notes = models.IntegerField(default=0)
    num_phrases = models.IntegerField(default=0)
    analysis_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis: {self.session.name} — {self.key}"
