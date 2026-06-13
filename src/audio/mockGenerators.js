// Mock generators — produce plausible drum patterns from clip duration alone,
// for UI development and as the MockAnalysisBackend's output. No audio analysis.

import { DEFAULT_BPM } from './constants.js'

/**
 * Generate a believable 4-on-the-floor-ish pattern for the segment length.
 *
 * @param {import('./types.js').ClipSegment} segment
 * @param {number} [bpm]
 * @returns {import('./types.js').DrumExtractionResult}
 */
export function mockDrumPattern(segment, bpm = DEFAULT_BPM) {
  const duration = segment.duration
  const secondsPerBeat = 60 / bpm
  const sixteenth = secondsPerBeat / 4
  const steps = Math.floor(duration / sixteenth)

  /** @type {import('./types.js').DrumHit[]} */
  const hits = []
  const rand = mulberry32(Math.floor(duration * 1000) || 1)

  for (let i = 0; i < steps; i++) {
    const time = i * sixteenth
    const beat = i % 16

    // Kick on 1 and 3 (+ occasional syncopation).
    if (beat % 8 === 0 || (beat === 6 && rand() > 0.6)) {
      hits.push({ time, lane: 'kick', velocity: vel(rand, 96, 118), confidence: 0.9 })
    }
    // Snare on 2 and 4.
    if (beat === 4 || beat === 12) {
      hits.push({ time, lane: 'snare', velocity: vel(rand, 90, 115), confidence: 0.85 })
    }
    // Hi-hat on every 8th, alternating accents.
    if (beat % 2 === 0) {
      hits.push({ time, lane: 'hihat', velocity: vel(rand, beat % 4 === 0 ? 80 : 55, beat % 4 === 0 ? 100 : 75), confidence: 0.8 })
    }
    // Occasional perc.
    if (rand() > 0.92) {
      hits.push({ time, lane: 'perc', velocity: vel(rand, 50, 90), confidence: 0.4 })
    }
  }

  return {
    hits: hits.sort((a, b) => a.time - b.time),
    bpm,
    source: 'mock',
    isApproximate: true,
    log: [
      'Preparing audio',
      'Separating drums (mock)',
      `Generated ${hits.length} hits from ${duration.toFixed(1)}s @ ${bpm} BPM`,
    ],
  }
}

function vel(rand, lo, hi) {
  return Math.round(lo + rand() * (hi - lo))
}

// Small deterministic PRNG so the same clip yields the same mock pattern.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
