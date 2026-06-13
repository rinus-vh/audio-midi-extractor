// MockAnalysisBackend — no real audio analysis. Generates plausible results
// from clip duration. Useful for UI development and as a guaranteed fallback.

import { getSegment } from '../AudioClip.js'
import { mockDrumPattern } from '../mockGenerators.js'
import { DEFAULT_BPM } from '../constants.js'
import { NotImplementedError } from './AnalysisBackend.js'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/** @type {import('./AnalysisBackend.js').AnalysisBackend} */
export const MockAnalysisBackend = {
  id: 'mock',
  label: 'Mock',
  isApproximate: true,

  async isAvailable() { return true },

  async analyzeClip() {
    await delay(300)
    return {
      source: 'mock',
      bpm: DEFAULT_BPM,
      materials: [
        { mode: 'drums', confidence: 0.9, available: true },
        { mode: 'bass', confidence: 0.6, available: false, note: 'Coming next' },
        { mode: 'lead', confidence: 0.5, available: false, note: 'Coming next' },
      ],
    }
  },

  async extractDrums(clip, range, options = {}) {
    const segment = getSegment(clip, range)
    const stages = ['Preparing audio', 'Separating drums', 'Detecting onsets', 'Classifying hits', 'Estimating velocities', 'Building MIDI']
    for (const s of stages) { options.onStage?.(s); await delay(180) }
    return mockDrumPattern(segment, options.bpm ?? DEFAULT_BPM)
  },

  async extractBass() { throw new NotImplementedError('bass') },
  async extractLead() { throw new NotImplementedError('lead') },
}
