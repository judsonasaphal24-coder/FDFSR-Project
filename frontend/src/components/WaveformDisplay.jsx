/**
 * WaveformDisplay Component
 * =========================
 * Real-time canvas-based waveform visualization.
 */
import React, { useRef, useEffect, useCallback } from 'react';

export default function WaveformDisplay({ waveform, isRecording, rms = 0, height = 120 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(18, 18, 30, 0.9)');
    bgGrad.addColorStop(1, 'rgba(10, 10, 20, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!waveform || waveform.length === 0) {
      // Idle state text
      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(isRecording ? 'Listening...' : 'Audio waveform', w / 2, h / 2 + 4);
      return;
    }

    // Draw waveform
    const sliceWidth = w / waveform.length;
    const amplitude = Math.min(1, rms * 10 + 0.3);

    // Glow effect
    ctx.shadowColor = 'rgba(0, 212, 255, 0.3)';
    ctx.shadowBlur = 8;

    // Gradient stroke
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, `rgba(0, 212, 255, ${amplitude})`);
    grad.addColorStop(0.5, `rgba(0, 255, 136, ${amplitude})`);
    grad.addColorStop(1, `rgba(168, 85, 247, ${amplitude})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < waveform.length; i++) {
      const x = i * sliceWidth;
      const y = (waveform[i] * 0.5 + 0.5) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // RMS indicator
    if (isRecording) {
      ctx.fillStyle = rms > 0.01 ? 'var(--accent-secondary)' : 'var(--text-muted)';
      ctx.beginPath();
      ctx.arc(12, 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [waveform, isRecording, rms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;
      ctx_scale(canvas);
    }
  }, [height]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div id="waveform-display" style={styles.container}>
      <div style={styles.label} className="label">WAVEFORM</div>
      <div style={{ ...styles.canvasWrap, height }}>
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  );
}

function ctx_scale(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    paddingLeft: 4,
    fontSize: '0.6rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  canvasWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-secondary)',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
  },
};
