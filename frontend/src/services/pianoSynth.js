/**
 * Piano Synth Engine
 * ==================
 * High-quality Web Audio API synthesizer that simulates a grand piano.
 * Uses additive synthesis with harmonic partials, ADSR envelope,
 * hammer strike transient, and subtle detuning for realism.
 */

export class PianoSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverb = null;
    this.activeNotes = new Map();
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
    });

    // Compressor for dynamics
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    // Reverb (convolution with generated impulse)
    this.reverb = await this._createReverb(1.2, 2.0);

    // Signal chain: notes -> compressor -> reverb+dry -> master -> output
    const dryGain = this.ctx.createGain();
    dryGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    const wetGain = this.ctx.createGain();
    wetGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.compressor.connect(dryGain);
    this.compressor.connect(this.reverb);
    this.reverb.connect(wetGain);
    dryGain.connect(this.masterGain);
    wetGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  async _createReverb(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  /**
   * Play a piano note.
   * @param {number} midiNote - MIDI note number (21-108)
   * @param {number} velocity - Velocity 0-127
   * @param {number} [duration] - Duration in seconds (null = sustained)
   */
  noteOn(midiNote, velocity = 80, duration = null) {
    if (!this.isInitialized) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Stop if already playing
    this.noteOff(midiNote);

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const vel = Math.max(0, Math.min(127, velocity)) / 127;
    const now = this.ctx.currentTime;

    // ADSR based on register
    const isLow = midiNote < 48;
    const isHigh = midiNote > 72;
    const attackTime = isHigh ? 0.001 : 0.005;
    const decayTime = isLow ? 2.5 : isHigh ? 0.8 : 1.5;
    const sustainLevel = isLow ? 0.15 : isHigh ? 0.05 : 0.1;
    const releaseTime = isLow ? 1.5 : isHigh ? 0.3 : 0.6;

    // Harmonic partial strengths (piano timbre)
    const partials = [
      { ratio: 1.0,    amp: 1.0 },
      { ratio: 2.0,    amp: 0.5 },
      { ratio: 3.0,    amp: 0.35 },
      { ratio: 4.0,    amp: 0.15 },
      { ratio: 5.0,    amp: 0.08 },
      { ratio: 6.0,    amp: 0.04 },
      { ratio: 7.0,    amp: 0.02 },
      { ratio: 8.0,    amp: 0.01 },
    ];

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, now);
    // Attack
    noteGain.gain.linearRampToValueAtTime(vel * 0.8, now + attackTime);
    // Decay to sustain
    noteGain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, vel * sustainLevel),
      now + attackTime + decayTime
    );

    // Filter for brightness based on velocity
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      800 + vel * 8000 + (isHigh ? 2000 : 0),
      now
    );
    filter.frequency.exponentialRampToValueAtTime(
      400 + vel * 2000,
      now + decayTime
    );
    filter.Q.setValueAtTime(0.7, now);

    const oscillators = [];

    for (const partial of partials) {
      const osc = this.ctx.createOscillator();
      // Slight detuning on higher partials for richness
      const detune = (Math.random() - 0.5) * 2 * partial.ratio;
      osc.frequency.setValueAtTime(freq * partial.ratio + detune, now);
      osc.type = partial.ratio <= 3 ? 'sine' : 'sine';

      const partialGain = this.ctx.createGain();
      partialGain.gain.setValueAtTime(partial.amp, now);
      // Higher partials decay faster
      partialGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, partial.amp * 0.01),
        now + decayTime * (1.5 / partial.ratio)
      );

      osc.connect(partialGain);
      partialGain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    }

    // Hammer strike transient (short noise burst)
    const noiseLength = 0.015;
    const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * noiseLength, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(vel * 0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(freq * 2, now);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(noteGain);
    noiseSource.start(now);

    filter.connect(noteGain);
    noteGain.connect(this.compressor);

    const noteData = { oscillators, noteGain, filter, noiseSource, releaseTime };
    this.activeNotes.set(midiNote, noteData);

    // Auto-release if duration specified
    if (duration != null && duration > 0) {
      setTimeout(() => this.noteOff(midiNote), duration * 1000);
    }
  }

  noteOff(midiNote) {
    const note = this.activeNotes.get(midiNote);
    if (!note) return;

    const now = this.ctx.currentTime;
    const { oscillators, noteGain, releaseTime } = note;

    // Release envelope
    noteGain.gain.cancelScheduledValues(now);
    noteGain.gain.setValueAtTime(noteGain.gain.value, now);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    // Stop oscillators after release
    for (const osc of oscillators) {
      osc.stop(now + releaseTime + 0.1);
    }

    this.activeNotes.delete(midiNote);
  }

  allNotesOff() {
    for (const [midi] of this.activeNotes) {
      this.noteOff(midi);
    }
  }

  setVolume(vol) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  destroy() {
    this.allNotesOff();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

/**
 * Play a sequence of MIDI notes with timing.
 * @param {PianoSynth} synth
 * @param {Array} notes - Array of { pitch, velocity, start_time, duration }
 * @param {number} startTime - Start offset in seconds
 * @param {Function} onProgress - Callback with current time
 * @returns {{ stop: Function, promise: Promise }}
 */
export function playMidiSequence(synth, notes, startTime = 0, onProgress = null) {
  let stopped = false;
  let timeouts = [];
  let progressInterval = null;
  const playStartMs = performance.now();
  const playStartOffset = startTime;
  let resolved = false;
  let resolvePromise = null;

  const sorted = [...notes].sort((a, b) =>
    (a.start_time || 0) - (b.start_time || 0)
  );

  const promise = new Promise((resolve) => {
    resolvePromise = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    for (const note of sorted) {
      const noteStart = (note.start_time || 0) - playStartOffset;
      const dur = note.duration || 0.3;
      const vel = note.velocity || 80;
      const pitch = note.pitch || note.midi_note || 60;

      if (noteStart < 0) continue;

      const tid = setTimeout(() => {
        if (!stopped) {
          synth.noteOn(pitch, vel, dur);
        }
      }, noteStart * 1000);
      timeouts.push(tid);
    }

    if (onProgress) {
      progressInterval = setInterval(() => {
        if (stopped) return;
        const elapsed = (performance.now() - playStartMs) / 1000 + playStartOffset;
        onProgress(elapsed);
      }, 50);
    }

    // Total duration
    const maxEnd = sorted.reduce((mx, n) =>
      Math.max(mx, (n.start_time || 0) + (n.duration || 0.3)), 0
    );
    const totalMs = (maxEnd - playStartOffset) * 1000 + 500;

    const endTid = setTimeout(() => {
      stopped = true;
      if (progressInterval) clearInterval(progressInterval);
      resolvePromise();
    }, totalMs);
    timeouts.push(endTid);
  });

  return {
    stop() {
      stopped = true;
      timeouts.forEach(clearTimeout);
      if (progressInterval) clearInterval(progressInterval);
      synth.allNotesOff();
      if (resolvePromise) resolvePromise();
    },
    promise,
  };
}
