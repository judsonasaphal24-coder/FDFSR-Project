"""
WebSocket Consumer for Real-Time Audio Analysis
================================================
Receives PCM audio chunks from the browser via WebSocket,
runs real-time pitch detection, and streams results back.
"""
import json
import struct
import numpy as np
from channels.generic.websocket import WebsocketConsumer
from dsp.pitch_detection import detect_pitch_realtime
from dsp.key_detection import detect_key_from_pitches
from dsp.chord_detection import detect_chord_from_chroma
from dsp.audio_utils import compute_rms


class AudioAnalysisConsumer(WebsocketConsumer):
    """
    Real-time audio analysis WebSocket consumer.

    Protocol:
    - Client sends binary PCM float32 audio frames (2048 samples)
    - Server responds with JSON analysis results per frame
    - Every N frames, server sends rolling key/chord analysis
    """

    def connect(self):
        self.accept()
        self.sample_rate = 44100
        self.frame_count = 0
        self.pitch_history = []
        self.chroma_accumulator = np.zeros(12)
        self.analysis_interval = 20  # Run key/chord every N frames
        self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Audio analysis stream ready',
            'config': {
                'sample_rate': self.sample_rate,
                'frame_size': 2048,
                'format': 'float32',
            },
        }))

    def disconnect(self, close_code):
        self.pitch_history = []
        self.chroma_accumulator = np.zeros(12)

    def receive(self, text_data=None, bytes_data=None):
        """Process incoming audio frame."""
        if bytes_data:
            self._process_audio_frame(bytes_data)
        elif text_data:
            self._handle_text_message(text_data)

    def _process_audio_frame(self, raw_bytes: bytes):
        """Convert raw bytes to numpy array and analyze."""
        try:
            # Decode PCM float32
            num_samples = len(raw_bytes) // 4
            samples = np.array(
                struct.unpack(f'{num_samples}f', raw_bytes),
                dtype=np.float32,
            )

            # Skip silent frames
            rms = compute_rms(samples)
            if rms < 0.003:
                self.send(text_data=json.dumps({
                    'type': 'pitch',
                    'frame': self.frame_count,
                    'silent': True,
                    'rms': round(rms, 5),
                }))
                self.frame_count += 1
                return

            # Real-time pitch detection
            pitch_result = detect_pitch_realtime(samples, self.sample_rate)
            pitch_result['type'] = 'pitch'
            pitch_result['frame'] = self.frame_count
            pitch_result['rms'] = round(rms, 4)
            pitch_result['time'] = round(
                self.frame_count * len(samples) / self.sample_rate, 3
            )

            # Accumulate for rolling analysis
            if pitch_result['f'] > 0:
                self.pitch_history.append({
                    'frequency': pitch_result['f'],
                    'confidence': pitch_result['c'],
                    'time': pitch_result['time'],
                    'midi': pitch_result['m'],
                })

                # Update chroma accumulator
                from dsp.audio_utils import freq_to_pitch_class
                pc = freq_to_pitch_class(pitch_result['f'])
                if 0 <= pc < 12:
                    self.chroma_accumulator[pc] += pitch_result['c']

            # Send pitch result
            self.send(text_data=json.dumps(pitch_result))

            # Periodic rolling analysis
            self.frame_count += 1
            if self.frame_count % self.analysis_interval == 0:
                self._send_rolling_analysis()

        except Exception as e:
            self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e),
            }))

    def _send_rolling_analysis(self):
        """Send key and chord analysis based on accumulated data."""
        if len(self.pitch_history) < 10:
            return

        # Key detection from recent pitches
        recent = self.pitch_history[-200:]  # Last ~200 frames
        key_result = detect_key_from_pitches(recent)

        # Chord detection from accumulated chroma
        total = np.sum(self.chroma_accumulator)
        if total > 0:
            norm_chroma = self.chroma_accumulator / total
            chord_result = detect_chord_from_chroma(norm_chroma)
        else:
            chord_result = {'chord': 'N/C', 'confidence': 0}

        self.send(text_data=json.dumps({
            'type': 'analysis',
            'key': key_result['key'],
            'key_confidence': key_result['confidence'],
            'chord': chord_result['chord'],
            'chord_confidence': chord_result.get('confidence', 0),
            'notes_analyzed': len(self.pitch_history),
        }))

        # Decay the chroma accumulator (weighted forget)
        self.chroma_accumulator *= 0.8

    def _handle_text_message(self, text_data: str):
        """Handle text control messages."""
        try:
            data = json.loads(text_data)
            msg_type = data.get('type', '')

            if msg_type == 'config':
                self.sample_rate = data.get('sample_rate', 44100)
                self.analysis_interval = data.get('analysis_interval', 20)
                self.send(text_data=json.dumps({
                    'type': 'config_ack',
                    'sample_rate': self.sample_rate,
                }))

            elif msg_type == 'reset':
                self.pitch_history = []
                self.chroma_accumulator = np.zeros(12)
                self.frame_count = 0
                self.send(text_data=json.dumps({
                    'type': 'reset_ack',
                }))

            elif msg_type == 'get_summary':
                self._send_rolling_analysis()

        except json.JSONDecodeError:
            pass
