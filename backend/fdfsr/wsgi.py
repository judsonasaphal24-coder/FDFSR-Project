"""
WSGI config for FDFSR project.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fdfsr.settings')
application = get_wsgi_application()
