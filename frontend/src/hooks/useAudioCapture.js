/**
 * useAudioCapture Hook
 * ====================
 * Manages microphone capture lifecycle and provides
 * real-time waveform data and RMS levels.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from '../services/audioEngine';

export function useAudioCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [rms, setRms] = useState(0);
  const [waveform, setWaveform] = useState(new Float32Array(0));
  const [error, setError] = useState(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => {
      if (engineRef.current) engineRef.current.destroy();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateLoop = useCallback(() => {
    if (!engineRef.current?.isRecording) return;
    setWaveform(engineRef.current.getWaveformData());
    setRms(engineRef.current.getRMS());
    rafRef.current = requestAnimationFrame(updateLoop);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await engineRef.current.startCapture();
      setIsRecording(true);
      rafRef.current = requestAnimationFrame(updateLoop);
    } catch (err) {
      setError(err.message);
    }
  }, [updateLoop]);

  const stopRecording = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    engineRef.current?.stopCapture();
    setIsRecording(false);
    setRms(0);
  }, []);

  return {
    isRecording,
    rms,
    waveform,
    error,
    engine: engineRef.current,
    startRecording,
    stopRecording,
  };
}
