// Hit de-duplication.
//
// Onset detection runs on an amplitude envelope, so a single drum hit with a
// long decay (a kick especially) can produce a burst of onsets as its envelope
// ripples on the way down — yielding many stacked MIDI notes where there should
// be one. This collapses runs of same-lane hits that fall within a per-lane
// minimum gap into a single hit, keeping the attack time and the loudest
// velocity of the cluster.

import { MIN_LANE_GAP_MS } from './constants.js'

/**
 * @param {import('./types.js').DrumHit[]} hits
 * @param {Record<string, number>} [gapMsByLane]
 * @returns {import('./types.js').DrumHit[]}
 */
export function mergeHits(hits, gapMsByLane = MIN_LANE_GAP_MS) {
  const sorted = [...hits].sort((a, b) => a.time - b.time)

  const result = []
  /** lane → index in `result` of the cluster currently being built. */
  const clusterIndex = {}
  /** lane → time of the most recent hit seen for that lane (kept or merged). */
  const lastSeen = {}

  for (const hit of sorted) {
    const gap = (gapMsByLane[hit.lane] ?? 60) / 1000
    const idx = clusterIndex[hit.lane]

    // Compare against the last hit *seen* (sliding), not the cluster's first
    // hit, so a continuous ring collapses fully no matter how long it rings.
    if (idx !== undefined && hit.time - lastSeen[hit.lane] < gap) {
      const cluster = result[idx]
      if (hit.velocity > cluster.velocity) cluster.velocity = hit.velocity
      if ((hit.confidence ?? 0) > (cluster.confidence ?? 0)) cluster.confidence = hit.confidence
      lastSeen[hit.lane] = hit.time
      continue
    }

    result.push({ ...hit })
    clusterIndex[hit.lane] = result.length - 1
    lastSeen[hit.lane] = hit.time
  }

  return result.sort((a, b) => a.time - b.time)
}
