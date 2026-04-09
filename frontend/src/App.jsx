/**
 * FDFSR — Audio Intelligence Studio
 * ==================================
 * Main application component. DAW-style layout with:
 * - Record view (mic capture + pitch)
 * - MIDI view (upload + piano roll + playback + deep analysis)
 * - Analysis view (merged Analysis + Theory, audio upload + deep analysis)
 */
import React, { useState, useCallback, useMemo } from 'react';
import './App.css';

// Components
import Sidebar from './components/Sidebar';
import TransportControls from './components/TransportControls';
import WaveformDisplay from './components/WaveformDisplay';
import PitchVisualizer from './components/PitchVisualizer';
import PianoRoll from './components/PianoRoll';
import ChordDisplay from './components/ChordDisplay';
import KeyScalePanel from './components/KeyScalePanel';
import DAWTimeline from './components/DAWTimeline';
import AnalysisPanel from './components/AnalysisPanel';
import MidiUpload from './components/MidiUpload';
import AudioUpload from './components/AudioUpload';
import MidiPlaybackControls from './components/MidiPlaybackControls';
import MidiAnalysisDashboard from './components/MidiAnalysisDashboard';

// Hooks
import { useAudioCapture } from './hooks/useAudioCapture';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';

export default function App() {
  const [activeView, setActiveView] = useState('record');
  const [recordingTime, setRecordingTime] = useState(0);
  const [midiData, setMidiData] = useState(null);
  const [midiPlaybackTime, setMidiPlaybackTime] = useState(0);
  const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  const midiPlaybackRef = React.useRef(null);

  // Audio capture
  const { isRecording, rms, waveform, error: captureError, engine, startRecording, stopRecording } = useAudioCapture();

  // Client-side pitch detection
  const { pitch, pitchHistory, resetHistory } = usePitchDetection(engine, isRecording);

  // Analysis state
  const {
    currentSession, pitchData: sessionPitchData, noteSegments,
    chordEvents, theoryAnalysis, loading, error: analysisError,
    uploadAndAnalyze, runTheoryAnalysis, exportAnalysis,
  } = useAudioAnalysis();

  // Recording timer
  React.useEffect(() => {
    let interval;
    if (isRecording) {
      const start = Date.now();
      interval = setInterval(() => {
        setRecordingTime((Date.now() - start) / 1000);
      }, 50);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Handle record
  const handleRecord = useCallback(async () => {
    resetHistory();
    await startRecording();
  }, [startRecording, resetHistory]);

  // Handle stop
  const handleStop = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // Handle audio file upload (via the new AudioUpload component)
  const handleAudioUpload = useCallback(async (file) => {
    try {
      const result = await uploadAndAnalyze(file, file.name);
      // Auto-switch to analysis view after successful upload
      setActiveView('analyze');
    } catch (err) {
      // Error is handled in the hook
    }
  }, [uploadAndAnalyze]);

  // Handle audio file upload via regular input change
  const handleAudioInputChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) handleAudioUpload(file);
  }, [handleAudioUpload]);

  // Handle MIDI analysis result
  const handleMidiAnalysis = useCallback((result) => {
    setMidiData(result);
  }, []);

  // Handle theory analysis
  const handleRunTheory = useCallback(async () => {
    if (currentSession?.id) {
      await runTheoryAnalysis(currentSession.id);
    }
  }, [currentSession, runTheoryAnalysis]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (currentSession?.id) {
      await exportAnalysis(currentSession.id);
    }
  }, [currentSession, exportAnalysis]);

  // Derived data
  const analysisResult = currentSession?.analysis || null;
  const midiNotes = useMemo(() => {
    if (midiData?.analysis?.notes) {
      // Normalize notes to always have 'pitch' field
      return midiData.analysis.notes.map(n => ({
        ...n,
        pitch: n.pitch || n.midi_note || 60,
        velocity: n.velocity || 80,
        start_time: n.start_time || 0,
        duration: n.duration || 0.1,
        note_name: n.note_name || '',
      }));
    }
    return [];
  }, [midiData]);
  const midiChords = useMemo(() => {
    if (midiData?.analysis?.chords) return midiData.analysis.chords;
    return [];
  }, [midiData]);

  return (
    <div id="app-root" className="app-layout">
      {/* Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Main Area */}
      <div className="main-area">
        {/* Transport Bar */}
        <TransportControls
          isRecording={isRecording}
          onRecord={handleRecord}
          onStop={handleStop}
          currentTime={isRecording ? recordingTime : (currentSession?.duration || 0)}
          currentKey={
            analysisResult?.key ||
            midiData?.analysis?.key?.key ||
            ''
          }
          currentChord={
            chordEvents?.[chordEvents.length - 1]?.chord_symbol || ''
          }
          rms={rms}
        />

        {/* Content Area */}
        <div className="content-area">
          {/* Left: Visualization */}
          <div className="viz-column">

            {/* ===== RECORD VIEW ===== */}
            {activeView === 'record' && (
              <div className="viz-stack animate-fade-in">
                <WaveformDisplay
                  waveform={waveform}
                  isRecording={isRecording}
                  rms={rms}
                />
                <PitchVisualizer
                  pitchHistory={pitchHistory}
                  isRecording={isRecording}
                />
                <DAWTimeline
                  duration={isRecording ? recordingTime : (currentSession?.duration || 30)}
                  currentTime={isRecording ? recordingTime : 0}
                  noteSegments={noteSegments}
                />
                <ChordDisplay
                  chords={chordEvents}
                  duration={currentSession?.duration || 10}
                />
              </div>
            )}

            {/* ===== MIDI VIEW ===== */}
            {activeView === 'midi' && (
              <div className="viz-stack animate-fade-in">
                <MidiUpload onAnalysisComplete={handleMidiAnalysis} />

                {midiNotes.length > 0 && (
                  <>
                    {/* Playback Controls */}
                    <MidiPlaybackControls
                      ref={midiPlaybackRef}
                      notes={midiNotes}
                      duration={midiData?.analysis?.duration || 10}
                      tempo={midiData?.analysis?.tempo_bpm || 120}
                      onTimeUpdate={setMidiPlaybackTime}
                      onPlayStateChange={setIsMidiPlaying}
                    />

                    {/* Piano Roll */}
                    <PianoRoll
                      notes={midiNotes}
                      duration={midiData?.analysis?.duration || 10}
                      currentTime={midiPlaybackTime}
                      followPlayback={isMidiPlaying}
                      onSeek={(t) => {
                        setMidiPlaybackTime(t);
                        midiPlaybackRef.current?.seekTo?.(t, { resume: isMidiPlaying });
                      }}
                    />

                    {/* Chord Timeline */}
                    <ChordDisplay
                      chords={midiChords}
                      duration={midiData?.analysis?.duration || 10}
                    />

                    {/* Deep MIDI Analysis Dashboard */}
                    <MidiAnalysisDashboard
                      analysis={midiData?.analysis}
                    />
                  </>
                )}
              </div>
            )}

            {/* ===== ANALYSIS VIEW (merged Analysis + Theory) ===== */}
            {activeView === 'analyze' && (
              <div className="viz-stack animate-fade-in">
                {/* Audio Upload Section */}
                <AudioUpload
                  onUpload={handleAudioUpload}
                  loading={loading}
                  error={analysisError}
                />

                {currentSession ? (
                  <>
                    <DAWTimeline
                      duration={currentSession.duration || 30}
                      noteSegments={noteSegments}
                    />
                    <PitchVisualizer
                      pitchHistory={sessionPitchData.map((p) => ({
                        frequency: p.frequency,
                        midi: p.midi_note,
                        cents: p.cents,
                        note: p.note_name,
                        confidence: p.confidence,
                        time: p.time,
                      }))}
                      isRecording={false}
                    />
                    <ChordDisplay
                      chords={chordEvents}
                      duration={currentSession.duration || 10}
                    />
                    <AnalysisPanel
                      pitchData={sessionPitchData}
                      noteSegments={noteSegments}
                      chordEvents={chordEvents}
                      analysis={analysisResult}
                      theoryAnalysis={theoryAnalysis}
                      onExport={handleExport}
                      onRunTheory={handleRunTheory}
                      loading={loading}
                    />
                  </>
                ) : (
                  !loading && (
                    <div className="empty-state-inline">
                      <span style={{ fontSize: '2rem', opacity: 0.4 }}>📊</span>
                      <p>Upload an audio file above to see full musical analysis</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Supports MP3, WAV, FLAC, OGG, AIFF, AAC, M4A
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Right: Info Panel */}
          <div className="info-column">
            {/* Current Pitch Display */}
            <div className="pitch-display glass-panel">
              <div className="label">CURRENT PITCH</div>
              <div className="pitch-note">{pitch.note}</div>
              <div className="pitch-freq mono">
                {pitch.frequency > 0 ? `${pitch.frequency.toFixed(1)} Hz` : '— Hz'}
              </div>
              <div
                className="pitch-cents mono"
                style={{
                  color: Math.abs(pitch.cents) <= 10 ? 'var(--accent-secondary)' :
                         Math.abs(pitch.cents) <= 25 ? 'var(--accent-warm)' : 'var(--error)',
                }}
              >
                {pitch.cents > 0 ? '+' : ''}{pitch.cents.toFixed(1)}¢
              </div>
              <div className="pitch-confidence">
                <div className="conf-bar">
                  <div
                    className="conf-fill"
                    style={{ width: `${pitch.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Key/Scale Panel */}
            <KeyScalePanel
              analysis={analysisResult || {
                key: midiData?.analysis?.key?.key || '',
                key_confidence: midiData?.analysis?.key?.confidence || 0,
                scale: '',
                analysis_json: {},
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
