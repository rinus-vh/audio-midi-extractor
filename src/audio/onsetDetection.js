// Onset detection via spectral-flux on the RMS envelope with adaptive
// thresholding and energy-recovery gating.
//
// Key design: after each onset we gate further detections until the envelope
// has dropped to RECOVERY_RATIO × the peak energy seen since that onset.
// This is adaptive — a long kick at 80 BPM holds the gate open for its full
// decay, while a short hi-hat releases immediately, without any fixed time.
// A hard floor (hardMinMs) is kept only as a safety valve against click noise.

import { rmsEnvelope } from './dsp.js'

// Energy must drop to this fraction of the post-onset peak before we allow
// the next onset. 0.35 = 35 %. Tune higher → stricter (fewer false re-fires),
// tune lower → more permissive (faster hi-hat runs still work).
const RECOVERY_RATIO = 0.35

/**
 * Detect onset times (seconds, relative to the segment) in a mono signal.
 *
 * @param {Float32Array} mono
 * @param {number} sampleRate
 * @param {{ sensitivity?: number, hardMinMs?: number }} [opts]
 *   sensitivity  – adaptive threshold multiplier (default 1.5; higher = fewer onsets)
 *   hardMinMs    – absolute minimum gap in ms regardless of recovery (default 30)
 * @returns {number[]} onset times in seconds
 */
export function detectOnsets(mono, sampleRate, opts = {}) {
  const sensitivity = opts.sensitivity ?? 1.5
  const hardMinMs   = opts.hardMinMs   ?? 30

  const { env, hop } = rmsEnvelope(mono, sampleRate, 5, 20)
  if (env.length < 3) return []

  // Positive first difference = rising energy.
  const flux = new Float32Array(env.length)
  for (let i = 1; i < env.length; i++) {
    const d = env[i] - env[i - 1]
    flux[i] = d > 0 ? d : 0
  }

  const windowFrames = Math.max(4, Math.floor(0.15 * sampleRate / hop))
  const hardMinFrames = Math.max(1, Math.floor((hardMinMs / 1000) * sampleRate / hop))

  const onsets = []
  let lastOnsetFrame = -hardMinFrames
  let gated = false       // true while waiting for energy to recover
  let gateMaxEnv = 0      // running peak of envelope since last onset

  for (let i = 1; i < flux.length - 1; i++) {
    // --- energy-recovery gate -------------------------------------------
    if (gated) {
      // Keep updating the peak so a ringing tail doesn't fool us.
      if (env[i] > gateMaxEnv) gateMaxEnv = env[i]
      // Un-gate only once energy is genuinely quiet AND the hard floor passed.
      if (env[i] < gateMaxEnv * RECOVERY_RATIO && i - lastOnsetFrame >= hardMinFrames) {
        gated = false
      }
    }

    // --- adaptive threshold for this frame ------------------------------
    const from = Math.max(0, i - windowFrames)
    const to   = Math.min(flux.length, i + windowFrames)
    let sum = 0
    for (let j = from; j < to; j++) sum += flux[j]
    const localMean = sum / (to - from)
    const threshold = localMean * sensitivity + 1e-4

    // --- onset candidate ------------------------------------------------
    const isPeak = flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]
    if (!gated && isPeak && flux[i] > threshold) {
      onsets.push((i * hop) / sampleRate)
      lastOnsetFrame = i
      gateMaxEnv = env[i]
      gated = true
    }
  }

  return onsets
}

/**
 * Rough tempo estimate from inter-onset intervals (median-interval based).
 * Returns undefined when there isn't enough rhythmic information.
 *
 * @param {number[]} onsets seconds
 * @returns {number | undefined}
 */
export function estimateBpm(onsets) {
  if (onsets.length < 4) return undefined
  const intervals = []
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1]
    if (d > 0.08 && d < 2) intervals.push(d)
  }
  if (intervals.length < 3) return undefined
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  let bpm = 60 / median
  while (bpm < 70)  bpm *= 2
  while (bpm > 180) bpm /= 2
  return Math.round(bpm)
}
