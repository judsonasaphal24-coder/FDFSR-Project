#!/usr/bin/env Rscript
# ============================================================================
# Chord Analysis — R Script
# ============================================================================
# Detailed chord voicing analysis, inversion detection, and 
# extended chord quality detection.
# Usage: Rscript chord_analysis.R <path_to_midi_file>
# ============================================================================

suppressPackageStartupMessages({
  library(jsonlite)
})

NOTE_NAMES <- c("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

# Detect chord inversion based on bass note
detect_inversion <- function(pitches, root_pc) {
  if (length(pitches) == 0) return("root")
  
  bass_pc <- min(pitches) %% 12
  
  if (bass_pc == root_pc) return("root")
  
  # Check intervals from root
  interval <- (bass_pc - root_pc) %% 12
  
  if (interval == 3 || interval == 4) return("1st")  # 3rd in bass
  if (interval == 7) return("2nd")   # 5th in bass
  if (interval == 10 || interval == 11) return("3rd")  # 7th in bass
  
  return("root")
}

# Extended chord quality detection
detect_extended_quality <- function(pitch_class_set) {
  pcs <- sort(unique(pitch_class_set))
  if (length(pcs) < 2) return(list(quality = "single", extensions = list()))
  
  extensions <- list()
  
  for (root in 0:11) {
    intervals <- sort((pcs - root) %% 12)
    
    # Check for 9th (interval 2 or 14 from root)
    if (2 %in% intervals) extensions <- c(extensions, "9")
    # Check for 11th (interval 5)
    if (5 %in% intervals && 7 %in% intervals) extensions <- c(extensions, "11")
    # Check for 13th (interval 9)
    if (9 %in% intervals && 7 %in% intervals) extensions <- c(extensions, "13")
    # Suspended
    if (2 %in% intervals && !(3 %in% intervals) && !(4 %in% intervals)) {
      extensions <- c(extensions, "sus2")
    }
    if (5 %in% intervals && !(3 %in% intervals) && !(4 %in% intervals)) {
      extensions <- c(extensions, "sus4")
    }
  }
  
  return(list(quality = "extended", extensions = unique(extensions)))
}

# Main
args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 1) {
  cat(toJSON(list(
    message = "Chord analysis module ready",
    usage = "Rscript chord_analysis.R <json_input>"
  ), auto_unbox = TRUE))
  quit(status = 0)
}

tryCatch({
  input <- fromJSON(args[1])
  
  results <- lapply(input$chords, function(chord) {
    pitches <- chord$pitches
    root_pc <- chord$root_pc
    
    inversion <- detect_inversion(pitches, root_pc)
    extended <- detect_extended_quality(pitches %% 12)
    
    list(
      chord = chord$chord,
      root = chord$root,
      inversion = inversion,
      extensions = extended$extensions,
      voicing = list(
        num_notes = length(pitches),
        range = if (length(pitches) > 0) max(pitches) - min(pitches) else 0,
        spacing = if (length(pitches) > 1) diff(sort(pitches)) else list()
      )
    )
  })
  
  cat(toJSON(list(chord_details = results), auto_unbox = TRUE))
  
}, error = function(e) {
  cat(toJSON(list(error = e$message), auto_unbox = TRUE))
  quit(status = 1)
})
