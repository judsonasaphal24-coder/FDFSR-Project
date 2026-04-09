/**
 * usePitchDetection Hook
 * ======================
 * Real-time pitch detection using the AudioEngine's
 * client-side autocorrelation detector.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { freqToNoteName, freqToCents, freqToMidi } from '../utils/noteUtils';

export function usePitchDetection(engine, isRecording) {
  const [pitch, setPitch] = useState({ frequency: 0, note: '--', cents: 0, confidence: 0, midi: 0 });
  const [pitchHistory, setPitchHistory] = useState([]);
  const rafRef = useRef(null);
  const historyRef = useRef([]);

  const detect = useCallback(() => {
    if (!engine || !isRecording) return;

    const result = engine.detectPitch();
    const freq = result.frequency;
    const conf = result.confidence;

    const current = {
      frequency: Math.round(freq * 100) / 100,
      note: freqToNoteName(freq),
      cents: Math.round(freqToCents(freq) * 10) / 10,
      confidence: Math.round(conf * 1000) / 1000,
      midi: freq > 0 ? Math.round(freqToMidi(freq) * 100) / 100 : 0,
      time: performance.now() / 1000,
    };

    setPitch(current);

    // Maintain history (last 500 points)
    historyRef.current.push(current);
    if (historyRef.current.length > 500) {
      historyRef.current = historyRef.current.slice(-500);
    }
    setPitchHistory([...historyRef.current]);

    rafRef.current = requestAnimationFrame(detect);
  }, [engine, isRecording]);

  useEffect(() => {
    if (isRecording && engine) {
      rafRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, engine, detect]);

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    setPitchHistory([]);
  }, []);

  return { pitch, pitchHistory, resetHistory };
}
