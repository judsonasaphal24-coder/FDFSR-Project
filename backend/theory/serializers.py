"""
Theory App Serializers
"""
from rest_framework import serializers
from .models import TheoryAnalysis


class TheoryAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = TheoryAnalysis
        fields = '__all__'
