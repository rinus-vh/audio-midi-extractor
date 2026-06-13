// VelocityEstimator — derives MIDI velocity (1..127) from local energy around
// each onset, normalized per lane so each lane uses its full dynamic range.

import { peak, rms } from './dsp.js'

/**
 * Estimate velocities for a set of hits in place-safe fashion (returns new hits).
 *
 * @param {Float32Array} mono
 * @param {number} sampleRate
 * @param {Array<{ time: number, lane: import('./types.js').DrumLaneId }>} hits
 * @returns {number[]} raw energy per hit (caller maps to velocity)
 */
function rawEnergies(mono, sampleRate, hits) {
  const win = Math.floor(0.025 * sampleRate)
  return hits.map(h => {
    const c = Math.floor(h.time * sampleRate)
    // Combine peak (transient strength) and short RMS (body) for a stable measure.
    return 0.6 * peak(mono, c, c + win) + 0.4 * rms(mono, c, c + win)
  })
}

/**
 * Assign velocities to hits, normalizing within each lane.
 *
 * @param {Float32Array} mono
 * @param {number} sampleRate
 * @param {Array<{ time: number, lane: import('./types.js').DrumLaneId, confidence?: number }>} hits
 * @returns {import('./types.js').DrumHit[]}
 */
export function estimateVelocities(mono, sampleRate, hits) {
  const energies = rawEnergies(mono, sampleRate, hits)

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
    // Map to a musical range (avoid 0; keep a floor so quiet hits still sound).
    const velocity = Math.round(40 + norm * 87)
    return {
      time: h.time,
      lane: h.lane,
      velocity: Math.max(1, Math.min(127, velocity)),
      confidence: h.confidence,
    }
  })
}
