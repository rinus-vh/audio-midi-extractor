// DrumTranscriber — turns a drum stem/segment into DrumHit[].
//
// Planned implementation: a local OaF-Drums / Magenta / ADTOF-style model via
// the Python backend. Fallback implementation (here): onset detection +
// spectral band classification + energy-based velocity. The `log` it returns
// drives the staged progress UI and the debug panel.

import { detectOnsets, estimateBpm } from './onsetDetection.js'
import { precomputeBands, classifyOnset } from './hitClassifier.js'
import { estimateVelocities } from './velocityEstimator.js'
import { mergeHits } from './hitMerge.js'

/**
 * Transcribe drums from a segment using the heuristic pipeline.
 *
 * @param {import('./types.js').ClipSegment} segment
 * @param {{ sensitivity?: number, onStage?: (stage: string) => void }} [opts]
 * @returns {import('./types.js').DrumExtractionResult}
 */
export function transcribeDrums(segment, opts = {}) {
  const { mono, sampleRate } = segment
  const log = []
  const stage = (s) => { log.push(s); opts.onStage?.(s) }

  stage('Detecting onsets')
  const onsets = detectOnsets(mono, sampleRate, { sensitivity: opts.sensitivity ?? 1.5 })
  log.push(`Found ${onsets.length} onsets`)

  stage('Classifying hits')
  const bands = precomputeBands(mono, sampleRate)
  const classified = onsets.map(t => ({ time: t, ...classifyOnset(bands, t) }))

  stage('Estimating velocities')
  const estimated = estimateVelocities(mono, sampleRate, classified)

  // Collapse same-lane onset bursts from ringing hits into single notes.
  const hits = mergeHits(estimated)
  if (estimated.length !== hits.length) {
    log.push(`Merged ${estimated.length - hits.length} duplicate hit(s)`)
  }

  const bpm = estimateBpm(onsets)
  if (bpm) log.push(`Estimated tempo ~${bpm} BPM`)

  return {
    hits,
    bpm,
    source: 'heuristic',
    isApproximate: true,
    log,
  }
}
