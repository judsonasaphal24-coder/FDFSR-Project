/**
 * useAudioAnalysis Hook
 * =====================
 * Combined hook for audio analysis state management.
 * Manages sessions, analysis results, and loading states.
 */
import { useState, useCallback } from 'react';
import * as api from '../services/api';

export function useAudioAnalysis() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [noteSegments, setNoteSegments] = useState([]);
  const [chordEvents, setChordEvents] = useState([]);
  const [theoryAnalysis, setTheoryAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSessions();
      setSessions(data.results || data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (id) => {
    try {
      setLoading(true);
      const data = await api.getSession(id);
      setCurrentSession(data);
      setPitchData(data.pitch_data || []);
      setNoteSegments(data.note_segments || []);
      setChordEvents(data.chord_events || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAndAnalyze = useCallback(async (file, name) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.uploadAudio(file, name);
      setCurrentSession(result);
      setPitchData(result.pitch_data || []);
      setNoteSegments(result.note_segments || []);
      setChordEvents(result.chord_events || []);
      return result;
    } catch (e) {
      // Extract the best error message from Axios
      const msg = e.response?.data?.error
        || e.response?.data?.audio_file?.[0]
        || e.response?.data?.detail
        || e.message
        || 'Upload failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const runTheoryAnalysis = useCallback(async (sessionId) => {
    try {
      setLoading(true);
      const result = await api.analyzeTheory(sessionId);
      setTheoryAnalysis(result);
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const exportAnalysis = useCallback(async (sessionId) => {
    try {
      const data = await api.exportSession(sessionId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fdfsr-analysis-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  return {
    sessions, currentSession, pitchData, noteSegments,
    chordEvents, theoryAnalysis, loading, error,
    loadSessions, loadSession, uploadAndAnalyze,
    runTheoryAnalysis, exportAnalysis,
  };
}
