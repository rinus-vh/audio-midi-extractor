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
 * Decision strategy (empirically derived — see note below): the single cleanest
 * discriminator with these gentle one-pole filters is the *high-band* ratio.
 * Measured against real material:
 *
 *   kick   → rHigh ≈ 0.02–0.05  (low/mid body, no sizzle)
 *   hi-hat → rHigh ≈ 0.45+      (high-frequency noise dominates)
 *   snare  → rHigh ≈ 0.15–0.35  (mid body + broadband noise)
 *
 * A 16× gap separates a kick's rHigh from a hi-hat's, so leading with rHigh is
 * far more reliable than the old "rank the three bands, bail to perc if the top
 * two are close" logic. That logic failed badly: a kick's energy splits roughly
 * evenly between the <150 Hz low band and the 180–2200 Hz mid band (the gentle
 * -6 dB/oct lowpass leaks the kick body into mid), so rLow ≈ rMid, the margin
 * fell under the 0.12 cutoff, and *every* kick was dumped into "perc".
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

  // Bright, sizzly transient → hi-hat / cymbal.
  if (rHigh >= 0.32) {
    return { lane: 'hihat', confidence: Math.min(0.95, 0.55 + (rHigh - 0.32)) }
  }

  // Negligible high-frequency content → a body-only hit (kick or snare).
  if (rHigh < 0.15) {
    // Kick body is low-heavy; a mid-leaning body without sizzle reads as snare.
    if (rLow >= rMid * 0.7) {
      return { lane: 'kick', confidence: Math.min(0.95, 0.5 + (rLow - rMid)) }
    }
    return { lane: 'snare', confidence: 0.5 + Math.min(0.3, rMid - rLow) }
  }

  // Moderate high-frequency noise over a mid body → snare. If the low band is
  // unexpectedly dominant in this middle zone, it's genuinely ambiguous → perc.
  if (rMid >= rLow) {
    return { lane: 'snare', confidence: 0.5 + Math.min(0.3, rHigh) }
  }
  return { lane: 'perc', confidence: 0.4 }
}
