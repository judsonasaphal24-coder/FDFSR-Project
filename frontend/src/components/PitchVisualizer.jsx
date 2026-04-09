/**
 * PitchVisualizer Component ⭐
 * ============================
 * Melodyne-style pitch visualization with note blobs,
 * pitch curves, cents deviation coloring, and piano guide.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { midiToY, midiToNoteName, NOTE_NAMES } from '../utils/noteUtils';
import { getCentsColor, getConfidenceColor } from '../utils/colorUtils';

const MIN_NOTE = 36;  // C2
const MAX_NOTE = 84;  // C6
const NOTE_RANGE = MAX_NOTE - MIN_NOTE;

export default function PitchVisualizer({ pitchHistory, isRecording, height = 300 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(800);

  // Handle resize
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

    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, w, h);

    // Draw semitone grid lines
    for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
      const y = getY(midi, h);
      const isC = midi % 12 === 0;
      const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);

      ctx.strokeStyle = isC 
        ? 'rgba(255, 255, 255, 0.1)' 
        : 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = isC ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Black key background bands
      if (isBlack) {
        const bandH = h / NOTE_RANGE;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.fillRect(50, y - bandH / 2, w - 50, bandH);
      }

      // Note labels (piano guide) — only for C and some notes
      if (midi % 12 === 0 || midi % 12 === 4 || midi % 12 === 7) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(midiToNoteName(midi), 46, y + 3);
      }
    }

    // Piano guide bar
    ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
    ctx.fillRect(0, 0, 50, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(50, h);
    ctx.stroke();

    // Piano key indicators
    for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
      const y = getY(midi, h);
      const pc = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);

      ctx.fillStyle = isBlack ? 'rgba(100, 100, 120, 0.4)' : 'rgba(200, 200, 220, 0.15)';
      const keyH = h / NOTE_RANGE * 0.7;
      ctx.fillRect(2, y - keyH / 2, isBlack ? 28 : 44, keyH);
    }

    if (!pitchHistory || pitchHistory.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(
        isRecording ? 'Waiting for pitch data...' : 'Start recording to see pitch visualization',
        w / 2 + 25, h / 2
      );
      return;
    }

    // Time window: show last N points fitting the width
    const maxPoints = Math.min(pitchHistory.length, Math.floor((w - 50) / 2));
    const visibleHistory = pitchHistory.slice(-maxPoints);
    const pixelsPerPoint = (w - 50) / maxPoints;

    // Draw pitch blobs (Melodyne-style)
    let currentNoteStart = 0;
    let currentMidi = -1;
    const noteBlobs = [];

    // Segment into note blobs
    for (let i = 0; i < visibleHistory.length; i++) {
      const pt = visibleHistory[i];
      if (pt.frequency <= 0 || pt.confidence < 0.3) {
        if (currentMidi > 0) {
          noteBlobs.push({
            startIdx: currentNoteStart,
            endIdx: i,
            points: visibleHistory.slice(currentNoteStart, i),
          });
          currentMidi = -1;
        }
        continue;
      }

      const roundedMidi = Math.round(pt.midi);
      if (currentMidi < 0 || Math.abs(roundedMidi - currentMidi) > 0.8) {
        if (currentMidi > 0) {
          noteBlobs.push({
            startIdx: currentNoteStart,
            endIdx: i,
            points: visibleHistory.slice(currentNoteStart, i),
          });
        }
        currentMidi = roundedMidi;
        currentNoteStart = i;
      }
    }
    if (currentMidi > 0) {
      noteBlobs.push({
        startIdx: currentNoteStart,
        endIdx: visibleHistory.length,
        points: visibleHistory.slice(currentNoteStart),
      });
    }

    // Draw each note blob
    for (const blob of noteBlobs) {
      if (blob.points.length < 2) continue;

      const avgMidi = blob.points.reduce((s, p) => s + p.midi, 0) / blob.points.length;
      const avgCents = blob.points.reduce((s, p) => s + p.cents, 0) / blob.points.length;
      const avgConf = blob.points.reduce((s, p) => s + p.confidence, 0) / blob.points.length;

      const x1 = 50 + blob.startIdx * pixelsPerPoint;
      const x2 = 50 + blob.endIdx * pixelsPerPoint;
      const blobW = Math.max(x2 - x1, 4);
      const y = getY(avgMidi, h);
      const blobH = Math.max(h / NOTE_RANGE * 0.6, 6);

      // Blob background with cents-based color
      const color = getCentsColor(avgCents);
      ctx.fillStyle = color + '40';  // 25% opacity
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 1;

      // Rounded rectangle blob
      const radius = 4;
      ctx.beginPath();
      ctx.roundRect(x1, y - blobH / 2, blobW, blobH, radius);
      ctx.fill();
      ctx.stroke();

      // Pitch curve inside blob
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j < blob.points.length; j++) {
        const px = 50 + (blob.startIdx + j) * pixelsPerPoint;
        const py = getY(blob.points[j].midi, h);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Note name label
      if (blobW > 20) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(blob.points[0].note, x1 + 4, y - blobH / 2 - 3);
      }
    }

    // Current pitch indicator (rightmost)
    const last = visibleHistory[visibleHistory.length - 1];
    if (last && last.frequency > 0 && last.confidence > 0.3) {
      const cx = w - 8;
      const cy = getY(last.midi, h);
      const color = getCentsColor(last.cents);

      // Glow dot
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Current note display
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(`${last.note}  ${last.cents > 0 ? '+' : ''}${last.cents}¢`, w - 16, cy - 10);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px "JetBrains Mono"';
      ctx.fillText(`${last.frequency} Hz`, w - 16, cy + 14);
    }

  }, [pitchHistory, isRecording, canvasWidth, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div id="pitch-visualizer" style={styles.container}>
      <div style={styles.header}>
        <span className="label">PITCH VISUALIZER</span>
        <span style={styles.badge}>Melodyne-style</span>
      </div>
      <div ref={containerRef} style={{ ...styles.canvasWrap, height }}>
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  );
}

function getY(midi, height) {
  return height - ((midi - MIN_NOTE) / NOTE_RANGE) * height;
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
  },
  badge: {
    fontSize: '0.55rem',
    padding: '1px 6px',
    borderRadius: 9999,
    background: 'rgba(168, 85, 247, 0.12)',
    color: 'var(--accent-purple)',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    fontWeight: 500,
  },
  canvasWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
};
