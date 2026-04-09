/**
 * API Service
 * ===========
 * Axios-based API client for Django REST backend.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Audio endpoints
// ---------------------------------------------------------------------------

export async function uploadAudio(file, name = 'Uploaded Audio') {
  const formData = new FormData();
  formData.append('audio_file', file);
  formData.append('name', name);
  const res = await api.post('/audio/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 120s — DSP analysis can take time on large files
  });
  return res.data;
}

export async function getSessions() {
  const res = await api.get('/audio/sessions/');
  return res.data;
}

export async function getSession(id) {
  const res = await api.get(`/audio/sessions/${id}/`);
  return res.data;
}

export async function getSessionPitch(id) {
  const res = await api.get(`/audio/sessions/${id}/pitch/`);
  return res.data;
}

export async function getSessionNotes(id) {
  const res = await api.get(`/audio/sessions/${id}/notes/`);
  return res.data;
}

export async function getSessionChords(id) {
  const res = await api.get(`/audio/sessions/${id}/chords/`);
  return res.data;
}

export async function exportSession(id) {
  const res = await api.get(`/audio/sessions/${id}/export/`);
  return res.data;
}

export async function deleteSession(id) {
  await api.delete(`/audio/sessions/${id}/`);
}

// ---------------------------------------------------------------------------
// Theory endpoints
// ---------------------------------------------------------------------------

export async function analyzeTheory(sessionId) {
  const res = await api.post('/theory/analyze/', { session_id: sessionId });
  return res.data;
}

export async function getTheoryChords(sessionId) {
  const res = await api.get(`/theory/chords/${sessionId}/`);
  return res.data;
}

export async function getTheoryKey(sessionId) {
  const res = await api.get(`/theory/key/${sessionId}/`);
  return res.data;
}

// ---------------------------------------------------------------------------
// MIDI endpoints
// ---------------------------------------------------------------------------

export async function uploadMidi(file, name) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  const res = await api.post('/midi/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getMidiAnalysis(id) {
  const res = await api.get(`/midi/analysis/${id}/`);
  return res.data;
}

export async function getMidiPianoRoll(id) {
  const res = await api.get(`/midi/piano-roll/${id}/`);
  return res.data;
}

export async function listMidiFiles() {
  const res = await api.get('/midi/files/');
  return res.data;
}

export default api;
