"""
Theory App Models
"""
import uuid
from django.db import models
from audio.models import AudioSession


class TheoryAnalysis(models.Model):
    """Complete theory analysis linked to an audio session."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AudioSession, on_delete=models.CASCADE,
        related_name='theory_analyses', null=True, blank=True,
    )
    key = models.CharField(max_length=20)
    mode = models.CharField(max_length=20, default='major')
    cadences = models.JSONField(default=list, blank=True)
    matched_progressions = models.JSONField(default=list, blank=True)
    harmonic_distribution = models.JSONField(default=dict, blank=True)
    full_analysis = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Theory: {self.key} ({self.mode})"
