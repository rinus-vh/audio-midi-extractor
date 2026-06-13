// StemProvider — interface for isolating drums/bass/lead from a clip segment.
//
//   LocalDemucsStemProvider  → planned (handled by the Python backend later)
//   HeuristicStemProvider    → crude band isolation, good enough for transcription
//   MockStemProvider         → identity passthrough for UI development
//
// Each provider returns a ClipSegment-shaped stem so downstream modules don't
// care how it was produced.

import { bandpass } from './dsp.js'

/**
 * @typedef {Object} StemProvider
 * @property {string} id
 * @property {(segment: import('./types.js').ClipSegment, stem: import('./types.js').ExtractionMode) => Promise<import('./types.js').ClipSegment>} getStem
 */

/** Passthrough: returns the original segment unchanged. */
export const MockStemProvider = {
  id: 'mock',
  async getStem(segment) {
    return segment
  },
}

/**
 * Heuristic isolation by frequency emphasis. For drums we keep the full band
 * (transients live everywhere); bass/lead get band-limited so the planned
 * melody transcribers receive something sensible even before Demucs exists.
 */
export const HeuristicStemProvider = {
  id: 'heuristic',
  async getStem(segment, stem) {
    const { mono, sampleRate } = segment
    let out = mono
    if (stem === 'bass') out = bandpass(mono, sampleRate, 50, 300)
    else if (stem === 'lead') out = bandpass(mono, sampleRate, 300, 4000)
    // drums → keep full-band (transients span the whole spectrum)
    return { ...segment, mono: out }
  },
}
