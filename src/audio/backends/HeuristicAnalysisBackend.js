// HeuristicAnalysisBackend — real (if rough) local analysis using Web Audio +
// the FFT-free DSP modules. Good enough to test the full UX end to end with
// actual audio content. Still flagged isApproximate so the UI labels it.

import { getSegment } from '../AudioClip.js'
import { scanFeatures } from '../featureScanner.js'
import { transcribeDrums } from '../drumTranscriber.js'
import { HeuristicStemProvider } from '../stemProvider.js'
import { NotImplementedError } from './AnalysisBackend.js'

// Yield to the event loop so progress UI can paint between heavy stages.
const tick = () => new Promise(r => setTimeout(r, 0))

/** @type {import('./AnalysisBackend.js').AnalysisBackend} */
export const HeuristicAnalysisBackend = {
  id: 'heuristic',
  label: 'Heuristic (local)',
  isApproximate: true,

  async isAvailable() { return true },

  async analyzeClip(clip, range) {
    const segment = getSegment(clip, range)
    await tick()
    const { materials, bpm } = scanFeatures(segment)
    return { source: 'heuristic', bpm, materials }
  },

  async extractDrums(clip, range, options = {}) {
    const segment = getSegment(clip, range)

    options.onStage?.('Preparing audio')
    await tick()

    options.onStage?.('Separating drums')
    const stem = await HeuristicStemProvider.getStem(segment, 'drums')
    await tick()

    const result = transcribeDrums(stem, {
      sensitivity: options.sensitivity,
      onStage: options.onStage,
    })
    await tick()

    options.onStage?.('Building MIDI')
    return result
  },

  async extractBass() { throw new NotImplementedError('bass') },
  async extractLead() { throw new NotImplementedError('lead') },
}
