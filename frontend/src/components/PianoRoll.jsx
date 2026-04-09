/**
 * PianoRoll Component
 * ===================
 * Grid-based MIDI note display with velocity coloring.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { midiToNoteName, NOTE_NAMES } from '../utils/noteUtils';
import { getVelocityColor } from '../utils/colorUtils';

const MIN_NOTE = 24;
const MAX_NOTE = 96;

export default function PianoRoll({
  notes = [],
  duration = 10,
  height = 280,
  currentTime = 0,
  followPlayback = false,
  onSeek = null,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [scrollX, setScrollX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pxPerSecRef = useRef(100);
  const pianoWidthRef = useRef(48);
  const dragRef = useRef({ active: false, raf: null, pendingTime: null });
  const playheadColorRef = useRef(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvasWidth;
    const h = height;
    const noteRange = MAX_NOTE - MIN_NOTE;
    const noteHeight = h / noteRange;
    const pianoWidth = 48;
    const contentWidth = w - pianoWidth;
    const totalWidth = Math.max(contentWidth, duration * 100 * zoom);
    const pxPerSec = totalWidth / Math.max(duration, 1);

    pxPerSecRef.current = pxPerSec;
    pianoWidthRef.current = pianoWidth;
    if (!playheadColorRef.current && typeof window !== 'undefined') {
      const c = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-primary')
        .trim();
      playheadColorRef.current = c || 'rgba(255,255,255,0.7)';
    }

    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = '#0c0c16';
    ctx.fillRect(0, 0, w, h);

    // Note rows
    for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
      const y = h - (midi - MIN_NOTE) * noteHeight;
      const pc = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);

      if (isBlack) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(pianoWidth, y - noteHeight, contentWidth, noteHeight);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pianoWidth, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Beat grid
    const beatDuration = 0.5; // quarter note
    for (let t = 0; t < duration; t += beatDuration) {
      const x = pianoWidth + t * pxPerSec - scrollX;
      if (x < pianoWidth || x > w) continue;
      const isBeat = Math.round(t * 2) % 2 === 0;
      ctx.strokeStyle = isBeat
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = isBeat ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw notes
    for (const note of notes) {
      const pitch = note.pitch || note.midi_note || 60;
      const startTime = note.start_time || 0;
      const dur = note.duration || 0.1;
      const velocity = note.velocity || note.velocity_estimate * 127 || 80;

      const x = pianoWidth + startTime * pxPerSec - scrollX;
      const noteW = Math.max(dur * pxPerSec, 2);
      const y = h - (pitch - MIN_NOTE) * noteHeight;

      if (x + noteW < pianoWidth || x > w) continue;

      // Note rectangle
      const color = getVelocityColor(velocity);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;

      const radius = Math.min(2, noteW / 2);
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight + 1, noteW, noteHeight - 2, radius);
      ctx.fill();
      ctx.stroke();

      // Note name inside (if wide enough)
      if (noteW > 25) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '8px "JetBrains Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(
          note.note_name || midiToNoteName(pitch),
          x + 3, y - noteHeight / 2 + 3
        );
      }
    }

    // Piano guide
    ctx.fillStyle = 'rgba(12, 12, 22, 0.97)';
    ctx.fillRect(0, 0, pianoWidth, h);

    for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
      const y = h - (midi - MIN_NOTE) * noteHeight;
      const pc = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);

      ctx.fillStyle = isBlack ? 'rgba(80, 80, 100, 0.5)' : 'rgba(180, 180, 200, 0.15)';
      ctx.fillRect(1, y - noteHeight + 1, isBlack ? 28 : pianoWidth - 2, noteHeight - 2);

      if (pc === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '8px "JetBrains Mono"';
        ctx.textAlign = 'right';
        ctx.fillText(midiToNoteName(midi), pianoWidth - 4, y - noteHeight / 2 + 3);
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pianoWidth, 0);
    ctx.lineTo(pianoWidth, h);
    ctx.stroke();

    // Playhead
    const playheadX = pianoWidth + currentTime * pxPerSec - scrollX;
    if (playheadX >= pianoWidth && playheadX <= w) {
      ctx.strokeStyle = playheadColorRef.current || 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
    }

    // Empty state
    if (notes.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a MIDI file to see the piano roll', w / 2, h / 2);
    }
  }, [notes, duration, canvasWidth, height, scrollX, zoom, currentTime]);

  useEffect(() => { draw(); }, [draw]);

  // Follow playback by scrolling so the playhead stays fixed in view
  useEffect(() => {
    if (!followPlayback) return;
    const w = canvasWidth;
    const pianoWidth = pianoWidthRef.current;
    const contentWidth = Math.max(0, w - pianoWidth);
    const totalWidth = Math.max(contentWidth, duration * 100 * zoom);
    const pxPerSec = totalWidth / Math.max(duration, 1);

    const fixedX = contentWidth * 0.5; // keep playhead centered
    const desired = currentTime * pxPerSec - fixedX;
    const maxScroll = Math.max(0, totalWidth - contentWidth);
    setScrollX(Math.max(0, Math.min(maxScroll, desired)));
  }, [currentTime, followPlayback, canvasWidth, duration, zoom]);

  const timeFromClientX = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    const pianoWidth = pianoWidthRef.current;
    const pxPerSec = pxPerSecRef.current || 100;
    if (x <= pianoWidth) return 0;
    const t = (scrollX + (x - pianoWidth)) / pxPerSec;
    return Math.max(0, Math.min(duration || 0, t));
  }, [duration, scrollX]);

  const emitSeek = useCallback((t) => {
    if (!onSeek) return;
    onSeek(t);
  }, [onSeek]);

  const scheduleSeek = useCallback((t) => {
    if (!onSeek) return;
    dragRef.current.pendingTime = t;
    if (dragRef.current.raf) return;
    dragRef.current.raf = requestAnimationFrame(() => {
      dragRef.current.raf = null;
      if (dragRef.current.pendingTime != null) {
        emitSeek(dragRef.current.pendingTime);
      }
    });
  }, [emitSeek, onSeek]);

  const handlePointerDown = useCallback((e) => {
    if (!onSeek) return;
    if (e.button !== 0) return;
    dragRef.current.active = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const t = timeFromClientX(e.clientX);
    scheduleSeek(t);
  }, [onSeek, scheduleSeek, timeFromClientX]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const t = timeFromClientX(e.clientX);
    scheduleSeek(t);
  }, [scheduleSeek, timeFromClientX]);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.2, Math.min(5, z + e.deltaY * -0.002)));
    } else {
      const delta = (e.deltaX || 0) + (e.deltaY || 0);
      setScrollX(s => Math.max(0, s + delta));
    }
  };

  return (
    <div id="piano-roll" style={styles.container}>
      <div style={styles.header}>
        <span className="label">PIANO ROLL</span>
        <span style={styles.noteCount}>{notes.length} notes</span>
      </div>
      <div
        ref={containerRef}
        style={{ ...styles.canvasWrap, height }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  noteCount: {
    fontSize: '0.6rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  canvasWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    cursor: 'grab',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
};
