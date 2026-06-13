// HitClassifier — maps a detected onset to a drum lane using band-energy ratios.
//
// Fallback heuristics (per the brief):
//   kick:  low-frequency energy dominant
//   snare: mid-band transient/noise dominant
//   hihat: high-frequency transient/noise dominant
//   perc:  uncertain / mixed hits
//
// `precomputeBands` filters the whole segment once; `classifyOnset` then just
// measures local RMS in each band around the onset — cheap per-hit.

import { lowpass, bandpass, highpass, rms } from './dsp.js'

const LOW_CUTOFF = 150    // kick body
const MID_LOW = 180
const MID_HIGH = 2200     // snare body / noise
const HIGH_CUTOFF = 6000  // hi-hat / cymbal noise

/**
 * @param {Float32Array} mono
 * @param {number} sampleRate
 */
export function precomputeBands(mono, sampleRate) {
  return {
    low: lowpass(mono, sampleRate, LOW_CUTOFF),
    mid: bandpass(mono, sampleRate, MID_LOW, MID_HIGH),
    high: highpass(mono, sampleRate, HIGH_CUTOFF),
    sampleRate,
  }
}

/**
 * Classify a single onset given precomputed bands.
 *
 * @param {ReturnType<typeof precomputeBands>} bands
 * @param {number} timeSec onset time relative to segment
 * @returns {{ lane: import('./types.js').DrumLaneId, confidence: number }}
 */
export function classifyOnset(bands, timeSec) {
  const { sampleRate } = bands
  const center = Math.floor(timeSec * sampleRate)
  const win = Math.floor(0.03 * sampleRate) // 30ms transient window

  const low = rms(bands.low, center, center + win)
  const mid = rms(bands.mid, center, center + win)
  const high = rms(bands.high, center, center + win)

  const total = low + mid + high + 1e-9
  const rLow = low / total
  const rMid = mid / total
  const rHigh = high / total

  // Pick the dominant band; confidence = how dominant it is over the runner-up.
  const ranked = [
    { lane: 'kick', r: rLow },
    { lane: 'snare', r: rMid },
    { lane: 'hihat', r: rHigh },
  ].sort((a, b) => b.r - a.r)

  const top = ranked[0]
  const second = ranked[1]
  const margin = top.r - second.r

  // Mixed / ambiguous hit → perc/other.
  if (margin < 0.12) {
    return { lane: 'perc', confidence: 0.35 + margin }
  }

  return {
    lane: /** @type {import('./types.js').DrumLaneId} */ (top.lane),
    confidence: Math.min(0.95, 0.5 + margin),
  }
}
