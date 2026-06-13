// AnalysisBackend — the single interface the React layer talks to. Every
// backend (mock, heuristic, future local Python/ML) implements this shape so
// the UI never depends on how analysis is actually performed.
//
// @typedef {Object} AnalysisBackend
// @property {string} id
// @property {string} label
// @property {boolean} isApproximate            True for mock/heuristic.
// @property {() => Promise<boolean>} isAvailable
// @property {(clip: import('../types.js').AudioClip, range: import('../types.js').TrimRange) => Promise<import('../types.js').AnalysisSummary>} analyzeClip
// @property {(clip, range, options) => Promise<import('../types.js').DrumExtractionResult>} extractDrums
// @property {(clip, range, options) => Promise<import('../types.js').MelodyExtractionResult>} extractBass
// @property {(clip, range, options) => Promise<import('../types.js').MelodyExtractionResult>} extractLead
//
// `extractBass`/`extractLead` are part of the contract now (architecture is
// prepared) but throw NotImplemented in v1 backends.

export class NotImplementedError extends Error {
  constructor(mode) {
    super(`${mode} extraction is not available yet`)
    this.name = 'NotImplementedError'
    this.mode = mode
  }
}

export {}
