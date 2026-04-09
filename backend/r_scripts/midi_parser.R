#!/usr/bin/env Rscript
# ============================================================================
# MIDI Parser & Analyzer — R Script
# ============================================================================
# Parses MIDI files and performs comprehensive music theory analysis.
# Outputs structured JSON to stdout for Django integration.
#
# Dependencies: tuneR, jsonlite
# Usage: Rscript midi_parser.R <path_to_midi_file>
# ============================================================================

suppressPackageStartupMessages({
  library(tuneR)
  library(jsonlite)
})

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NOTE_NAMES <- c("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

MAJOR_PROFILE <- c(6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                   2.52, 5.19, 2.39, 3.66, 2.29, 2.88)

MINOR_PROFILE <- c(6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                   2.54, 4.75, 3.98, 2.69, 3.34, 3.17)

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

midi_to_note_name <- function(midi_num) {
  octave <- floor(midi_num / 12) - 1
  note <- NOTE_NAMES[(midi_num %% 12) + 1]
  paste0(note, octave)
}

detect_key <- function(pitch_classes) {
  # Krumhansl-Schmuckler key detection
  pc <- pitch_classes / max(sum(pitch_classes), 1)
  
  best_corr <- -Inf
  best_key <- list(tonic = "C", mode = "major", key = "C major", confidence = 0)
  
  for (root in 0:11) {
    # Rotate profiles
    idx <- ((0:11 + root) %% 12) + 1
    
    maj_profile <- MAJOR_PROFILE[idx]
    corr_maj <- cor(pc, maj_profile)
    if (!is.na(corr_maj) && corr_maj > best_corr) {
      best_corr <- corr_maj
      best_key <- list(
        tonic = NOTE_NAMES[root + 1],
        mode = "major",
        key = paste(NOTE_NAMES[root + 1], "major"),
        confidence = round(max(0, corr_maj), 4)
      )
    }
    
    min_profile <- MINOR_PROFILE[idx]
    corr_min <- cor(pc, min_profile)
    if (!is.na(corr_min) && corr_min > best_corr) {
      best_corr <- corr_min
      best_key <- list(
        tonic = NOTE_NAMES[root + 1],
        mode = "minor",
        key = paste(NOTE_NAMES[root + 1], "minor"),
        confidence = round(max(0, corr_min), 4)
      )
    }
  }
  
  return(best_key)
}

identify_chord <- function(pitch_class_set) {
  # Chord templates
  templates <- list(
    maj = c(0, 4, 7),
    min = c(0, 3, 7),
    dim = c(0, 3, 6),
    aug = c(0, 4, 8),
    dom7 = c(0, 4, 7, 10),
    maj7 = c(0, 4, 7, 11),
    min7 = c(0, 3, 7, 10)
  )
  
  best_match <- list(chord = "N/C", root = "--", quality = "--", root_pc = -1, confidence = 0)
  best_score <- 0
  
  for (root in 0:11) {
    shifted <- (pitch_class_set - root) %% 12
    for (qname in names(templates)) {
      tmpl <- templates[[qname]]
      overlap <- sum(shifted %in% tmpl)
      coverage <- overlap / length(tmpl)
      if (coverage > best_score) {
        best_score <- coverage
        root_name <- NOTE_NAMES[root + 1]
        display_name <- if (qname == "maj") root_name
                       else if (qname == "min") paste0(root_name, "m")
                       else paste0(root_name, qname)
        best_match <- list(
          chord = display_name,
          root = root_name,
          quality = qname,
          root_pc = root,
          confidence = round(coverage, 3)
        )
      }
    }
  }
  
  return(best_match)
}

roman_numeral <- function(root_pc, tonic_pc, mode = "major") {
  major_map <- c("I", "", "ii", "", "iii", "IV", "", "V", "", "vi", "", "vii°")
  minor_map <- c("i", "", "ii°", "III", "", "iv", "", "V", "VI", "", "VII", "")
  
  degree <- (root_pc - tonic_pc) %% 12 + 1
  rn_map <- if (mode == "major") major_map else minor_map
  rn <- rn_map[degree]
  if (nchar(rn) == 0) rn <- paste0("#", degree - 1)
  return(rn)
}

harmonic_function <- function(degree) {
  funcs <- c("T", "", "S", "", "T", "S", "", "D", "", "T", "", "D")
  fn <- funcs[degree + 1]
  if (nchar(fn) == 0) fn <- "Chr"
  return(fn)
}

# ---------------------------------------------------------------------------
# Main Analysis
# ---------------------------------------------------------------------------

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 1) {
  cat(toJSON(list(error = "No MIDI file path provided"), auto_unbox = TRUE))
  quit(status = 1)
}

midi_path <- args[1]

if (!file.exists(midi_path)) {
  cat(toJSON(list(error = paste("File not found:", midi_path)), auto_unbox = TRUE))
  quit(status = 1)
}

tryCatch({
  # Read MIDI file
  midi <- readMidi(midi_path)
  
  # Extract note events
  note_events <- midi[midi$event == "Note On" | midi$event == "Note Off", ]
  
  if (nrow(note_events) == 0) {
    cat(toJSON(list(
      source = "r",
      error = "No note events found in MIDI file",
      num_tracks = length(unique(midi$track)),
      num_notes = 0
    ), auto_unbox = TRUE))
    quit(status = 0)
  }
  
  # Build note matrix
  notes <- data.frame(
    track = integer(),
    channel = integer(),
    pitch = integer(),
    velocity = integer(),
    start_time = numeric(),
    end_time = numeric(),
    duration = numeric(),
    note_name = character(),
    stringsAsFactors = FALSE
  )
  
  # Process note on/off pairs
  active <- list()
  ticks_per_beat <- 480  # Default, try to detect from header
  tempo_us <- 500000  # Default 120 BPM
  current_tick <- 0
  
  for (i in seq_len(nrow(midi))) {
    row <- midi[i, ]
    current_tick <- current_tick + row$time
    time_seconds <- current_tick * tempo_us / (ticks_per_beat * 1e6)
    
    if (row$event == "Note On" && row$parameter2 > 0) {
      key <- paste(row$track, row$channel, row$parameter1, sep = "_")
      active[[key]] <- list(
        track = row$track,
        channel = row$channel,
        pitch = row$parameter1,
        velocity = row$parameter2,
        start_time = time_seconds
      )
    } else if (row$event == "Note Off" || (row$event == "Note On" && row$parameter2 == 0)) {
      key <- paste(row$track, row$channel, row$parameter1, sep = "_")
      if (!is.null(active[[key]])) {
        n <- active[[key]]
        notes <- rbind(notes, data.frame(
          track = n$track,
          channel = n$channel,
          pitch = n$pitch,
          velocity = n$velocity,
          start_time = round(n$start_time, 4),
          end_time = round(time_seconds, 4),
          duration = round(time_seconds - n$start_time, 4),
          note_name = midi_to_note_name(n$pitch),
          stringsAsFactors = FALSE
        ))
        active[[key]] <- NULL
      }
    }
  }
  
  # Sort by start time
  if (nrow(notes) > 0) {
    notes <- notes[order(notes$start_time), ]
  }
  
  # Pitch class distribution
  pitch_classes <- rep(0, 12)
  for (i in seq_len(nrow(notes))) {
    pc <- (notes$pitch[i] %% 12) + 1
    pitch_classes[pc] <- pitch_classes[pc] + notes$duration[i]
  }
  
  # Key detection
  key_result <- detect_key(pitch_classes)
  tonic_pc <- which(NOTE_NAMES == key_result$tonic) - 1
  
  # Chord detection per beat
  bpm <- round(60e6 / tempo_us, 1)
  beat_dur <- 60.0 / bpm
  max_time <- if (nrow(notes) > 0) max(notes$end_time) else 0
  
  chords <- list()
  t <- 0
  while (t < max_time) {
    active_notes <- notes[notes$start_time <= t + beat_dur & notes$end_time > t, ]
    if (nrow(active_notes) > 0) {
      pcs <- unique(active_notes$pitch %% 12)
      chord <- identify_chord(pcs)
      chord$time <- round(t, 3)
      chord$duration <- round(beat_dur, 3)
      # Roman numeral
      chord$roman <- roman_numeral(chord$root_pc, tonic_pc, key_result$mode)
      chord$harmonic_function <- harmonic_function((chord$root_pc - tonic_pc) %% 12)
      chords <- c(chords, list(chord))
    }
    t <- t + beat_dur
  }
  
  # Voice leading analysis
  voice_leading <- list()
  if (nrow(notes) > 1) {
    for (i in 2:min(nrow(notes), 500)) {
      interval <- notes$pitch[i] - notes$pitch[i - 1]
      motion <- if (interval == 0) "static"
                else if (abs(interval) <= 2) "step"
                else if (abs(interval) <= 4) "small_leap"
                else "leap"
      
      voice_leading <- c(voice_leading, list(list(
        from_note = notes$note_name[i - 1],
        to_note = notes$note_name[i],
        interval = interval,
        semitones = abs(interval),
        direction = if (interval > 0) "up" else if (interval < 0) "down" else "same",
        motion_type = motion,
        time = notes$start_time[i]
      )))
    }
  }
  
  # Build output
  output <- list(
    source = "r",
    num_tracks = length(unique(midi$track)),
    num_notes = nrow(notes),
    duration = round(max_time, 2),
    tempo_bpm = bpm,
    time_signature = "4/4",
    key = key_result,
    notes = head(as.list(notes), 5000),
    chords = chords,
    roman_numerals = chords,  # Already includes roman numerals
    voice_leading = voice_leading,
    pitch_class_distribution = as.list(pitch_classes),
    harmonic_functions = lapply(chords, function(ch) {
      list(
        chord = ch$chord,
        function_label = ch$harmonic_function,
        roman = ch$roman,
        time = ch$time
      )
    })
  )
  
  cat(toJSON(output, auto_unbox = TRUE, pretty = FALSE))
  
}, error = function(e) {
  cat(toJSON(list(error = paste("R analysis failed:", e$message)), auto_unbox = TRUE))
  quit(status = 1)
})
