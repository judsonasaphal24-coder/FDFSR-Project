"""
Theory App URL Configuration
"""
from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.analyze_theory, name='theory-analyze'),
    path('chords/<uuid:session_id>/', views.get_chords, name='theory-chords'),
    path('key/<uuid:session_id>/', views.get_key, name='theory-key'),
]
