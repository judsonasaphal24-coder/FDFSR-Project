"""
Django settings for FDFSR project.
Full-Stack DAW + Melodyne-Style Audio Intelligence System
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-fdfsr-dev-key-change-in-production-!@#$%'
)

DEBUG = True

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'daphne',  # ASGI server — must be first for channels
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'corsheaders',
    'channels',
    # Local apps
    'audio',
    'theory',
    'midi_analysis',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'fdfsr.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'fdfsr.wsgi.application'
ASGI_APPLICATION = 'fdfsr.asgi.application'

# ---------------------------------------------------------------------------
# Channels (WebSocket layer)
# ---------------------------------------------------------------------------
CHANNEL_LAYERS = {
    'default': {
        # In-memory for development; switch to Redis for production
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# ---------------------------------------------------------------------------
# Database — SQLite for V1
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ---------------------------------------------------------------------------
# Auth password validators
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media files
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Open for dev; lock down for prod
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
}

# ---------------------------------------------------------------------------
# CORS — allow React dev server
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Audio processing settings
# ---------------------------------------------------------------------------
AUDIO_SETTINGS = {
    'SAMPLE_RATE': 44100,
    'CHANNELS': 1,  # Mono for analysis
    'CHUNK_SIZE': 2048,
    'HOP_SIZE': 512,
    'MAX_UPLOAD_SIZE_MB': 100,
    'SUPPORTED_FORMATS': ['wav', 'mp3', 'flac', 'ogg', 'aiff'],
}

# ---------------------------------------------------------------------------
# R integration settings
# ---------------------------------------------------------------------------
R_SETTINGS = {
    # R is optional. Keep it opt-in so MIDI upload doesn't block on slow/missing R deps.
    'ENABLED': os.environ.get('R_ANALYSIS_ENABLED', '0') == '1',
    'RSCRIPT_PATH': os.environ.get('RSCRIPT_PATH', 'Rscript'),
    'SCRIPTS_DIR': BASE_DIR / 'r_scripts',
    # Keep this comfortably below common frontend HTTP timeouts.
    'TIMEOUT_SECONDS': int(os.environ.get('R_TIMEOUT_SECONDS', '10')),
}
