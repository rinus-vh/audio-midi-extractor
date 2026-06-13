// Backend registry + selection.
//
// Resolution order favors the best available local option, but the app stays
// fully usable with only the heuristic/mock backends — no remote processing,
// ever. The Python/ML backend is preferred ONLY if a local loopback server is
// detected at runtime.

import { MockAnalysisBackend } from './MockAnalysisBackend.js'
import { HeuristicAnalysisBackend } from './HeuristicAnalysisBackend.js'
import { LocalPythonAnalysisBackend } from './LocalPythonAnalysisBackend.js'

export { MockAnalysisBackend, HeuristicAnalysisBackend, LocalPythonAnalysisBackend }

/** All known backends, in preference order. */
export const BACKENDS = [
  LocalPythonAnalysisBackend,
  HeuristicAnalysisBackend,
  MockAnalysisBackend,
]

export const BACKEND_BY_ID = Object.fromEntries(BACKENDS.map(b => [b.id, b]))

/**
 * Resolve the backend to use. If `preferredId` is given and available, it wins;
 * otherwise the first available backend in preference order is returned.
 *
 * @param {string} [preferredId]
 * @returns {Promise<import('./AnalysisBackend.js').AnalysisBackend>}
 */
export async function resolveBackend(preferredId) {
  if (preferredId && BACKEND_BY_ID[preferredId]) {
    const pref = BACKEND_BY_ID[preferredId]
    if (await safeAvailable(pref)) return pref
  }
  for (const backend of BACKENDS) {
    if (await safeAvailable(backend)) return backend
  }
  return MockAnalysisBackend
}

async function safeAvailable(backend) {
  try { return await backend.isAvailable() } catch { return false }
}
