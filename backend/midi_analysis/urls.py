"""
MIDI Analysis URL Configuration
"""
from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_midi, name='midi-upload'),
    path('files/', views.list_midi_files, name='midi-list'),
    path('analysis/<uuid:midi_id>/', views.get_midi_analysis, name='midi-analysis'),
    path('piano-roll/<uuid:midi_id>/', views.get_piano_roll, name='midi-piano-roll'),
]
