#!/usr/bin/env Rscript
# ============================================================================
# Harmonic Analysis — R Script
# ============================================================================
# Deep harmonic analysis: cadence detection, non-chord tones,
# and harmonic rhythm analysis.
# Usage: Rscript harmonic_analysis.R <path_to_midi_file>
# ============================================================================

suppressPackageStartupMessages({
  library(jsonlite)
})

NOTE_NAMES <- c("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

# Cadence detection
detect_cadences <- function(chord_sequence, tonic_pc, mode = "major") {
  if (length(chord_sequence) < 2) return(list())
  
  cadences <- list()
  
  for (i in 2:length(chord_sequence)) {
    prev <- chord_sequence[[i - 1]]
    curr <- chord_sequence[[i]]
    
    prev_degree <- (prev$root_pc - tonic_pc) %% 12
    curr_degree <- (curr$root_pc - tonic_pc) %% 12
    
    cadence_type <- NULL
    
    # Perfect Authentic Cadence: V -> I
    if (prev_degree == 7 && curr_degree == 0) {
      cadence_type <- "PAC"
    }
    # Half Cadence: anything -> V
    else if (curr_degree == 7) {
      cadence_type <- "HC"
    }
    # Plagal Cadence: IV -> I
    else if (prev_degree == 5 && curr_degree == 0) {
      cadence_type <- "PC"
    }
    # Deceptive Cadence: V -> vi
    else if (prev_degree == 7 && curr_degree == 9) {
      cadence_type <- "DC"
    }
    
    if (!is.null(cadence_type)) {
      cadences <- c(cadences, list(list(
        type = cadence_type,
        time = curr$time,
        from_chord = prev$chord,
        to_chord = curr$chord,
        from_roman = prev$roman,
        to_roman = curr$roman
      )))
    }
  }
  
  return(cadences)
}

# Main
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  cat(toJSON(list(error = "Usage: Rscript harmonic_analysis.R <chord_json>"), auto_unbox = TRUE))
  quit(status = 1)
}

tryCatch({
  input <- fromJSON(args[1])
  chords <- input$chords
  tonic_pc <- input$tonic_pc
  mode <- input$mode
  
  cadences <- detect_cadences(chords, tonic_pc, mode)
  
  # Harmonic rhythm (how often chords change)
  changes <- 0
  if (length(chords) > 1) {
    for (i in 2:length(chords)) {
      if (chords[[i]]$chord != chords[[i-1]]$chord) changes <- changes + 1
    }
  }
  total_time <- if (length(chords) > 0) {
    chords[[length(chords)]]$time + chords[[length(chords)]]$duration
  } else 0
  
  harmonic_rhythm <- if (total_time > 0) round(changes / total_time * 60, 2) else 0
  
  output <- list(
    cadences = cadences,
    harmonic_rhythm_cpm = harmonic_rhythm,
    total_chord_changes = changes
  )
  
  cat(toJSON(output, auto_unbox = TRUE))
  
}, error = function(e) {
  cat(toJSON(list(error = e$message), auto_unbox = TRUE))
  quit(status = 1)
})
