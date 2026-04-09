/**
 * Audio Engine Service
 * ====================
 * Manages Web Audio API graph for microphone capture,
 * monitoring, and audio worklet processing.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.isRecording = false;
    this.isInitialized = false;
    this.sampleRate = 44100;
    this.fftSize = 2048;
  }

  async init() {
    if (this.isInitialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive',
    });
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.3;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 1.0;
    this.isInitialized = true;
  }

  async startCapture() {
    await this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: this.sampleRate,
        channelCount: 1,
      },
    });
    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyserNode);
    this.sourceNode.connect(this.gainNode);
    this.isRecording = true;
  }

  stopCapture() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isRecording = false;
  }

  getWaveformData() {
    if (!this.analyserNode) return new Float32Array(0);
    const data = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(data);
    return data;
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getRMS() {
    const data = this.getWaveformData();
    if (data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Simple client-side autocorrelation pitch detection.
   * Fast enough for real-time visual feedback.
   */
  detectPitch() {
    const buf = this.getWaveformData();
    if (buf.length === 0) return { frequency: 0, confidence: 0 };

    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.005) return { frequency: 0, confidence: 0 };

    // Autocorrelation
    const correlations = new Float32Array(SIZE);
    for (let lag = 0; lag < SIZE; lag++) {
      let sum = 0;
      for (let i = 0; i < SIZE - lag; i++) {
        sum += buf[i] * buf[i + lag];
      }
      correlations[lag] = sum;
    }

    // Find first dip then next peak
    let d = 0;
    while (d < SIZE && correlations[d] > 0) d++;
    if (d >= SIZE) return { frequency: 0, confidence: 0 };

    let maxVal = -1, maxIdx = d;
    for (let i = d; i < SIZE; i++) {
      if (correlations[i] > maxVal) {
        maxVal = correlations[i];
        maxIdx = i;
      }
    }

    const T0 = maxIdx;
    if (T0 === 0) return { frequency: 0, confidence: 0 };

    // Parabolic interpolation
    let x1 = correlations[T0 - 1] || 0;
    let x2 = correlations[T0];
    let x3 = correlations[T0 + 1] || 0;
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    let shift = a !== 0 ? -b / (2 * a) : 0;

    const frequency = this.sampleRate / (T0 + shift);
    const confidence = maxVal / correlations[0];

    if (frequency < 50 || frequency > 2000) return { frequency: 0, confidence: 0 };

    return { frequency, confidence: Math.min(1, Math.max(0, confidence)) };
  }

  setMonitorVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  destroy() {
    this.stopCapture();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}
