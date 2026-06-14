// DrumTranscriber — turns a drum stem/segment into DrumHit[].
//
// Pipeline: onset detection on mono → per-band classification → velocity.
// The multi-band independent-detection approach was tried but failed because
// the one-pole IIR bandpass filters are not sharp enough: bass guitar bleeds
// through a 150 Hz lowpass into the kick detector, producing false positives.
// Mono detection with energy-recovery gating (in onsetDetection.js) gives a
// much cleaner onset list; classification then assigns lanes using band ratios.

import { detectOnsets, estimateBpm } from './onsetDetection.js'
import { precomputeBands, classifyOnset } from './hitClassifier.js'
import { estimateVelocities } from './velocityEstimator.js'
import { mergeHits } from './hitMerge.js'

/**
 * @param {import('./types.js').ClipSegment} segment
 * @param {{ sensitivity?: number, onStage?: (stage: string) => void }} [opts]
 * @returns {import('./types.js').DrumExtractionResult}
 */
export function transcribeDrums(segment, opts = {}) {
  const { mono, sampleRate } = segment
  const log = []
  const stage = (s) => { log.push(s); opts.onStage?.(s) }

  stage('Detecting onsets')
  const onsets = detectOnsets(mono, sampleRate, { sensitivity: opts.sensitivity ?? 2.0 })
  log.push(`Found ${onsets.length} onsets`)

  stage('Classifying hits')
  const bands = precomputeBands(mono, sampleRate)
  const classified = onsets.map(t => ({ time: t, ...classifyOnset(bands, t) }))

  stage('Estimating velocities')
  const estimated = estimateVelocities(classified, sampleRate, mono)

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
