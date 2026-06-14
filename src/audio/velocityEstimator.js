// VelocityEstimator — derives MIDI velocity (1..127) from local energy around
// each onset, normalized per lane so each lane uses its full dynamic range.
//
// Accepts an optional bandsByLane map so each lane's velocity is measured on
// its own frequency band rather than the full mono mix. This gives much cleaner
// readings — e.g. kick velocity isn't inflated by simultaneous snare energy.

import { peak, rms } from './dsp.js'

const WIN_S = 0.025 // 25 ms measurement window

/**
 * Assign velocities to hits, normalizing within each lane.
 *
 * @param {Array<{ time: number, lane: import('./types.js').DrumLaneId, confidence?: number }>} hits
 * @param {number} sampleRate
 * @param {Record<string, Float32Array> | Float32Array} bandsByLane
 *   Either a map of { kick, snare, hihat, perc } → Float32Array (preferred),
 *   or a single mono Float32Array for all lanes (legacy / fallback).
 * @returns {import('./types.js').DrumHit[]}
 */
export function estimateVelocities(hits, sampleRate, bandsByLane) {
  const win = Math.floor(WIN_S * sampleRate)

  const getSignal = (lane) => {
    if (bandsByLane instanceof Float32Array) return bandsByLane
    return bandsByLane[lane] ?? bandsByLane.perc ?? bandsByLane
  }

  const energies = hits.map(h => {
    const signal = getSignal(h.lane)
    const c = Math.floor(h.time * sampleRate)
    return 0.6 * peak(signal, c, c + win) + 0.4 * rms(signal, c, c + win)
  })

  // Per-lane min/max for normalization.
  const laneRange = {}
  hits.forEach((h, i) => {
    const e = energies[i]
    const r = laneRange[h.lane] ?? { min: Infinity, max: -Infinity }
    r.min = Math.min(r.min, e)
    r.max = Math.max(r.max, e)
    laneRange[h.lane] = r
  })

  return hits.map((h, i) => {
    const r = laneRange[h.lane]
    const span = r.max - r.min
    const norm = span > 1e-6 ? (energies[i] - r.min) / span : 0.7
    // Map to a musical range (40–127); avoid 0 so quiet hits still sound.
    const velocity = Math.round(40 + norm * 87)
    return {
      time: h.time,
      lane: h.lane,
      velocity: Math.max(1, Math.min(127, velocity)),
      confidence: h.confidence,
    }
  })
}
