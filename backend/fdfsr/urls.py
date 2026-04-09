"""
Root URL configuration for FDFSR.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def backend_portal(request):
    return JsonResponse({
        "status": "online",
        "service": "FDFSR Audio Intelligence Backend API",
        "endpoints": {
            "admin": "/admin/",
            "audio_api": "/api/audio/",
            "theory_api": "/api/theory/",
            "midi_api": "/api/midi/"
        }
    })


urlpatterns = [
    path('', backend_portal, name='backend_portal'),
    path('admin/', admin.site.urls),
    path('api/audio/', include('audio.urls')),
    path('api/theory/', include('theory.urls')),
    path('api/midi/', include('midi_analysis.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
