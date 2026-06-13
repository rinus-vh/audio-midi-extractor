// FeatureScanner — lightweight pre-extraction scan estimating whether the clip
// likely contains drums, bass, and/or lead material, with rough confidences.
//
// Replaceable later by an ML model; the return shape (MaterialDetection[]) is
// the contract the Analyze step depends on.

import { lowpass, bandpass, highpass, rms } from './dsp.js'
import { detectOnsets, estimateBpm } from './onsetDetection.js'

/**
 * @param {import('./types.js').ClipSegment} segment
 * @returns {{ materials: import('./types.js').MaterialDetection[], bpm?: number }}
 */
export function scanFeatures(segment) {
  const { mono, sampleRate } = segment

  const sub = lowpass(mono, sampleRate, 120)          // kick / sub-bass
  const bass = bandpass(mono, sampleRate, 60, 250)    // bass instrument range
  const mids = bandpass(mono, sampleRate, 250, 2000)  // lead / vocal body
  const highs = highpass(mono, sampleRate, 6000)      // cymbals / air

  const eSub = rms(sub, 0, sub.length)
  const eBass = rms(bass, 0, bass.length)
  const eMid = rms(mids, 0, mids.length)
  const eHigh = rms(highs, 0, highs.length)
  const total = eSub + eBass + eMid + eHigh + 1e-9

  const onsets = detectOnsets(mono, sampleRate, { sensitivity: 1.5 })
  const bpm = estimateBpm(onsets)
  const onsetDensity = onsets.length / Math.max(1, segment.duration) // hits/sec

  // Drums: strong transients (high onset density) + energy at the spectral
  // extremes (kick lows + hat highs).
  const drumScore = clamp01(
    0.5 * clamp01(onsetDensity / 6) +
    0.3 * clamp01((eSub + eHigh) / total * 2) +
    0.2 * (bpm ? 1 : 0)
  )

  // Bass: sustained low-mid energy without it all being transient sub.
  const bassScore = clamp01(0.7 * clamp01((eBass / total) * 2.5) + 0.3 * clamp01(eBass / (eSub + 1e-9)))

  // Lead: mid-band energy presence.
  const leadScore = clamp01((eMid / total) * 2)

  /** @type {import('./types.js').MaterialDetection[]} */
  const materials = [
    { mode: 'drums', confidence: drumScore, available: true },
    { mode: 'bass', confidence: bassScore, available: false, note: 'Coming next' },
    { mode: 'lead', confidence: leadScore, available: false, note: 'Coming next' },
  ]

  return { materials, bpm }
}

function clamp01(v) { return Math.min(1, Math.max(0, v)) }
