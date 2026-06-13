// Quantization helpers — snap hit times to a musical grid.

/**
 * Snap a time (seconds) to the nearest grid step for the given tempo.
 *
 * @param {number} timeSec
 * @param {number} bpm
 * @param {number} grid  note denominator (e.g. 16 → 1/16 notes)
 * @returns {number}
 */
export function quantizeTime(timeSec, bpm, grid) {
  const secondsPerBeat = 60 / bpm
  const step = secondsPerBeat * (4 / grid) // whole note = 4 beats
  return Math.round(timeSec / step) * step
}

/**
 * Return a copy of hits with times quantized, optionally blending toward the
 * grid by `amount` (0 = no change, 1 = full snap) so human timing can be
 * partially preserved.
 *
 * @param {import('./types.js').DrumHit[]} hits
 * @param {number} bpm
 * @param {number} grid
 * @param {number} [amount]
 * @returns {import('./types.js').DrumHit[]}
 */
export function quantizeHits(hits, bpm, grid, amount = 1) {
  return hits.map(h => {
    const snapped = quantizeTime(h.time, bpm, grid)
    const time = h.time + (snapped - h.time) * amount
    return { ...h, time }
  })
}
