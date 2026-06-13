// LocalPythonAnalysisBackend — adapter for an OPTIONAL local Python helper.
//
// This backend is prepared but NOT required. If you later run a small local
// server (e.g. FastAPI on http://127.0.0.1:8000) wrapping:
//   • Demucs        — local stem separation (drums/bass/other)
//   • OaF Drums / Magenta / ADTOF — drum transcription with velocity
//   • Basic Pitch / SPICE / MT3   — bass/lead melody → MIDI
// then this adapter talks to it. The frontend NEVER uploads audio to a remote
// server — the only endpoint is loopback (localhost). If the server isn't
// running, `isAvailable()` returns false and the app falls back to the
// heuristic/mock backends automatically.
//
// Expected (suggested) endpoints — implement on the Python side later:
//   GET  /health                         → 200
//   POST /analyze   (audio + range)      → AnalysisSummary
//   POST /extract/drums                  → DrumExtractionResult
//   POST /extract/bass | /extract/lead   → MelodyExtractionResult

const BASE_URL = 'http://127.0.0.1:8000'
const HEALTH_TIMEOUT_MS = 800

async function probe(path, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

/** Encode the selected segment as a WAV blob to POST to the local server. */
function segmentToWav(clip, range) {
  // Placeholder: a real implementation would render the trimmed segment to a
  // WAV Blob here (mono, clip.sampleRate) and attach it to the request body.
  // Left unimplemented on purpose — v1 never reaches this path unless a local
  // server is detected, and wiring it up is a backend task.
  void clip; void range
  throw new Error('LocalPythonAnalysisBackend transport not implemented in v1')
}

/** @type {import('./AnalysisBackend.js').AnalysisBackend} */
export const LocalPythonAnalysisBackend = {
  id: 'python',
  label: 'Local Python / ML',
  isApproximate: false,

  async isAvailable() {
    try {
      const res = await probe('/health')
      return res.ok
    } catch {
      return false
    }
  },

  async analyzeClip(clip, range) {
    segmentToWav(clip, range)
  },

  async extractDrums(clip, range) {
    segmentToWav(clip, range)
  },

  async extractBass(clip, range) {
    segmentToWav(clip, range)
  },

  async extractLead(clip, range) {
    segmentToWav(clip, range)
  },
}
