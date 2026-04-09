/**
 * MidiPlaybackControls Component
 * ==============================
 * Play/pause/stop MIDI file with piano synth, volume control,
 * playback position indicator, and tempo display.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PianoSynth, playMidiSequence } from '../services/pianoSynth';
import { formatTimeShort } from '../utils/noteUtils';

const MidiPlaybackControls = React.forwardRef(function MidiPlaybackControls({
  notes = [],
  duration = 10,
  tempo = 120,
  onTimeUpdate = null,
  onPlayStateChange = null,
}, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.6);
  const synthRef = useRef(null);
  const playbackRef = useRef(null);
  const playRunIdRef = useRef(0);

  // Initialize synth
  useEffect(() => {
    synthRef.current = new PianoSynth();
    return () => {
      if (synthRef.current) synthRef.current.destroy();
    };
  }, []);

  const updatePlaying = useCallback((next) => {
    setIsPlaying(next);
    if (onPlayStateChange) onPlayStateChange(next);
  }, [onPlayStateChange]);

  const updateTime = useCallback((time) => {
    setCurrentTime(time);
    if (onTimeUpdate) onTimeUpdate(time);
  }, [onTimeUpdate]);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.stop();
      playbackRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(async (startAt) => {
    if (notes.length === 0) return;

    const runId = ++playRunIdRef.current;
    const synth = synthRef.current;
    await synth.init();
    synth.setVolume(volume);

    updatePlaying(true);

    const playback = playMidiSequence(synth, notes, startAt, (time) => {
      updateTime(time);
    });

    playbackRef.current = playback;

    await playback.promise;
    if (playRunIdRef.current !== runId) return;

    playbackRef.current = null;
    updatePlaying(false);
  }, [notes, updatePlaying, updateTime, volume]);

  const handlePlay = useCallback(async () => {
    if (notes.length === 0) return;
    if (isPlaying) return;

    startPlayback(currentTime);
  }, [notes, isPlaying, currentTime, startPlayback]);

  const handlePause = useCallback(() => {
    stopPlayback();
    updatePlaying(false);
  }, [stopPlayback, updatePlaying]);

  const handleStop = useCallback(() => {
    stopPlayback();
    updatePlaying(false);
    updateTime(0);
  }, [stopPlayback, updatePlaying, updateTime]);

  const seekTo = useCallback((newTime, { resume } = { resume: false }) => {
    const clamped = Math.max(0, Math.min(duration || 0, newTime || 0));
    stopPlayback();
    updateTime(clamped);
    updatePlaying(false);
    if (resume) {
      startPlayback(clamped);
    }
  }, [duration, startPlayback, stopPlayback, updatePlaying, updateTime]);

  const handleSeek = useCallback((e) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime, { resume: isPlaying });
  }, [isPlaying, seekTo]);

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (synthRef.current?.isInitialized) {
      synthRef.current.setVolume(v);
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    seekTo,
    stop: handleStop,
    pause: handlePause,
    play: handlePlay,
    getState: () => ({ isPlaying, currentTime, duration, tempo, volume }),
  }), [seekTo, handleStop, handlePause, handlePlay, isPlaying, currentTime, duration, tempo, volume]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div id="midi-playback" style={styles.container}>
      {/* Transport buttons */}
      <div style={styles.transport}>
        <button
          style={styles.stopBtn}
          className="transport-btn"
          onClick={handleStop}
          title="Stop"
        >
          ■
        </button>
        <button
          style={styles.playBtn}
          className={`transport-btn ${isPlaying ? 'active' : ''}`}
          onClick={isPlaying ? handlePause : handlePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          disabled={notes.length === 0}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Time display */}
      <div style={styles.timeSection}>
        <span style={styles.timeText} className="mono">
          {formatTimeShort(currentTime)}
        </span>
        <span style={styles.timeSep}>/</span>
        <span style={styles.timeDur} className="mono">
          {formatTimeShort(duration)}
        </span>
      </div>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        <div style={styles.progressBg}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          style={styles.seekSlider}
        />
      </div>

      {/* Tempo */}
      <div style={styles.tempoChip}>
        <span style={styles.tempoLabel}>BPM</span>
        <span style={styles.tempoValue}>{Math.round(tempo)}</span>
      </div>

      {/* Volume */}
      <div style={styles.volumeWrap}>
        <span style={styles.volumeIcon}>
          {volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔇'}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolumeChange}
          style={styles.volSlider}
        />
      </div>

      {/* Synth badge */}
      <div style={styles.synthBadge}>
        🎹 Piano VST
      </div>
    </div>
  );
});

export default MidiPlaybackControls;

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 10,
    border: '1px solid var(--border-subtle)',
    flexWrap: 'wrap',
  },
  transport: {
    display: 'flex',
    gap: 6,
  },
  stopBtn: {
    width: 32,
    height: 32,
    fontSize: '10px',
  },
  playBtn: {
    width: 32,
    height: 32,
    fontSize: '14px',
  },
  timeSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 80,
  },
  timeText: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-bright)',
  },
  timeSep: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  timeDur: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
  },
  progressWrap: {
    flex: 1,
    minWidth: 120,
    position: 'relative',
    height: 20,
    display: 'flex',
    alignItems: 'center',
  },
  progressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    background: 'var(--bg-surface)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
    borderRadius: 2,
    transition: 'width 50ms linear',
  },
  seekSlider: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    height: 20,
    opacity: 0,
    cursor: 'pointer',
    zIndex: 1,
  },
  tempoChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'rgba(255, 160, 54, 0.08)',
    borderRadius: 6,
    border: '1px solid rgba(255, 160, 54, 0.15)',
  },
  tempoLabel: {
    fontSize: '0.4rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  tempoValue: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--accent-warm)',
    fontFamily: 'var(--font-mono)',
  },
  volumeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  volumeIcon: {
    fontSize: '0.8rem',
  },
  volSlider: {
    width: 50,
    height: 4,
    cursor: 'pointer',
  },
  synthBadge: {
    fontSize: '0.55rem',
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: 9999,
    background: 'rgba(0, 212, 255, 0.08)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(0, 212, 255, 0.15)',
    whiteSpace: 'nowrap',
  },
};
