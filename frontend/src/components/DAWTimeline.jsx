/**
 * DAWTimeline Component
 * =====================
 * Horizontal scrolling timeline with time ruler,
 * playhead, and track regions.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { formatTimeShort } from '../utils/noteUtils';

export default function DAWTimeline({
  duration = 30,
  currentTime = 0,
  noteSegments = [],
  height = 60,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(800);

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
    const pxPerSec = w / Math.max(duration, 1);

    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, w, h);

    // Time ruler
    const rulerH = 20;
    ctx.fillStyle = 'rgba(18, 18, 30, 0.95)';
    ctx.fillRect(0, 0, w, rulerH);

    // Time marks
    const interval = duration > 60 ? 10 : duration > 20 ? 5 : 1;
    for (let t = 0; t <= duration; t += interval) {
      const x = t * pxPerSec;
      // Major tick
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Time label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '9px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(formatTimeShort(t), x, 13);
    }

    // Sub-marks
    const subInterval = interval / 4;
    for (let t = 0; t <= duration; t += subInterval) {
      const x = t * pxPerSec;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, rulerH);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Note regions (audio blocks)
    const trackY = rulerH + 4;
    const trackH = h - rulerH - 8;

    if (noteSegments.length > 0) {
      for (const note of noteSegments) {
        const x = note.start_time * pxPerSec;
        const noteW = Math.max(note.duration * pxPerSec, 1);

        ctx.fillStyle = `rgba(0, 212, 255, ${0.15 + note.confidence * 0.35})`;
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(x, trackY, noteW, trackH, 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Ruler bottom line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerH);
    ctx.lineTo(w, rulerH);
    ctx.stroke();

    // Playhead
    const playheadX = currentTime * pxPerSec;
    ctx.strokeStyle = 'var(--accent-primary)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();

    // Playhead top triangle
    ctx.fillStyle = 'var(--accent-primary)';
    ctx.beginPath();
    ctx.moveTo(playheadX - 5, 0);
    ctx.lineTo(playheadX + 5, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }, [duration, currentTime, noteSegments, canvasWidth, height]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <div id="daw-timeline" style={styles.container}>
      <div ref={containerRef} style={{ ...styles.canvasWrap, height }}>
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
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
