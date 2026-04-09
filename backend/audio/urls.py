"""
Audio App URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'sessions', views.AudioSessionViewSet, basename='audio-session')

urlpatterns = [
    path('upload/', views.upload_and_analyze, name='audio-upload'),
    path('', include(router.urls)),
]
