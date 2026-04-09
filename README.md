# FDFSR — Audio Intelligence Studio

> A production-level DAW-like system with Melodyne-style pitch analysis, real-time audio intelligence, and deep music theory analysis.

![Status](https://img.shields.io/badge/status-v1.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![Django](https://img.shields.io/badge/django-4.2-darkgreen)
![React](https://img.shields.io/badge/react-18-blue)
![R](https://img.shields.io/badge/R-optional-lightgrey)

---

## 🎯 Features

### Real-Time Audio
- 🎤 Live microphone capture with low-latency pitch detection
- 📊 Melodyne-style pitch visualization (note blobs, cents deviation)
- 📈 Real-time waveform display
- 🎵 Client-side + server-side pitch detection (YIN algorithm)

### Music Theory Analysis
- 🎼 Key detection (Krumhansl-Schmuckler algorithm)
- 🎸 Chord detection via chroma template matching
- 🔢 Roman numeral analysis (I, IV, V, vi)
- 🏗️ Harmonic function labeling (Tonic/Dominant/Subdominant)
- 📐 Cadence detection (PAC, HC, DC, PC)
- 🎹 Common progression matching (Pop, Jazz ii-V-I, etc.)

### MIDI Import & R Analysis
- 📁 MIDI file upload with drag-and-drop
- 🔬 R language analysis via `tuneR` (subprocess bridge)
- 🐍 Python fallback via `mido` (no R required)
- 🎹 Piano roll visualization
- 🎵 Voice leading analysis

### DAW Interface
- ⏱️ Timeline with time ruler and playhead
- 🎚️ Transport controls (record, stop)
- 📊 Tabbed analysis panel
- 💎 Premium dark theme with glass-morphism

---

## 📁 Project Structure

```
FDFSR/
├── backend/                    # Django REST backend
│   ├── fdfsr/                  # Django project settings
│   ├── audio/                  # Audio processing app
│   ├── dsp/                    # DSP engine (pure Python)
│   │   ├── pitch_detection.py  # YIN algorithm
│   │   ├── onset_detection.py  # Spectral flux
│   │   ├── segmentation.py     # Note/phrase segmentation
│   │   ├── key_detection.py    # Krumhansl-Schmuckler
│   │   ├── chord_detection.py  # Template matching
│   │   └── audio_utils.py      # Audio helpers
│   ├── theory/                 # Music theory analyzer
│   ├── midi_analysis/          # MIDI + R integration
│   ├── r_scripts/              # R analysis scripts
│   └── requirements.txt
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── hooks/              # React hooks
│   │   ├── services/           # API & audio engine
│   │   └── utils/              # Helpers
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- R (optional, for MIDI analysis)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API to Django)
npm run dev
```

### R Setup (Optional)

```r
install.packages(c("tuneR", "jsonlite"))
```

---

## 🔌 API Endpoints

### Audio
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/upload/` | Upload audio file for analysis |
| GET | `/api/audio/sessions/` | List all sessions |
| GET | `/api/audio/sessions/<id>/` | Full session detail |
| GET | `/api/audio/sessions/<id>/pitch/` | Pitch data |
| GET | `/api/audio/sessions/<id>/notes/` | Note segments |
| GET | `/api/audio/sessions/<id>/chords/` | Chord events |
| GET | `/api/audio/sessions/<id>/export/` | Export JSON |

### Theory
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/theory/analyze/` | Run theory analysis |
| GET | `/api/theory/chords/<id>/` | Chord progression |
| GET | `/api/theory/key/<id>/` | Key detection |

### MIDI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/midi/upload/` | Upload MIDI file |
| GET | `/api/midi/files/` | List MIDI files |
| GET | `/api/midi/analysis/<id>/` | Analysis results |
| GET | `/api/midi/piano-roll/<id>/` | Piano roll data |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://host/ws/audio/analyze/` | Real-time audio analysis |

---

## 🧠 Algorithms

### YIN Pitch Detection
1. Compute difference function d(τ) via FFT-based autocorrelation
2. Cumulative mean normalization d'(τ) to avoid octave errors
3. Absolute threshold at 0.15 to find first valley
4. Parabolic interpolation for sub-sample accuracy
5. **Result**: f₀ = sample_rate / refined_lag

### Krumhansl-Schmuckler Key Detection
1. Build pitch class histogram from detected notes
2. Correlate with 24 key profiles (12 major + 12 minor)
3. Highest Pearson correlation = detected key

### Chord Detection (Template Matching)
1. Compute 12-dimensional chroma vector per time window
2. Compare against 16 chord templates using cosine similarity
3. Apply temporal smoothing (majority vote)
4. Merge consecutive identical chords

### Onset Detection (Spectral Flux)
1. Compute STFT magnitude spectrogram
2. Half-wave rectified spectral difference between frames
3. Adaptive threshold via local median + offset
4. Peak picking with minimum distance constraint

---

## 📊 Data Flow

```
Audio Path:
  Browser Mic → AudioWorklet → WebSocket → Django Consumer
    → DSP Pipeline (pitch, onset, key, chord) → WebSocket → React UI

Upload Path:
  Audio File → Django REST → DSP Analysis → Database → REST → React

MIDI Path:
  MIDI File → Django REST → R Bridge (subprocess) → JSON → Database → React
  (fallback: MIDI → Python mido → JSON)
```

---

## 🔮 Future Enhancements (V2+)

- **CREPE Neural Pitch Detection** — CNN-based for superior accuracy
- **Polyphonic Pitch Estimation** — Spotify's `basic-pitch`
- **AI Chord Suggestion** — Transformer model for next-chord prediction
- **Multi-track Mixing** — Full DAW with effects chain
- **Real-time Auto-Tune** — Pitch correction with formant preservation
- **Collaboration** — Multi-user real-time editing via CRDT
- **Training Datasets** — MDB-stem-synth, MedleyDB, MAESTRO

---

## 📄 License

MIT License — See LICENSE file for details.
