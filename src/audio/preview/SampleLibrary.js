// SampleLibrary — abstraction over a source of drum samples.
//
//   BundledSampleLibrary       → synthesized starter kit (now)
//   BrowserFolderSampleLibrary → user-selected local folder (future) via the
//                                File System Access API (showDirectoryPicker)
//   drag-and-drop import        → fallback when the API is unavailable (future)
//
// Each library resolves to a SampleKit { buffers: Record<lane, AudioBuffer> }.

import { getAudioContext } from '../decodeAudio.js'
import { renderSynthKit } from './synthKit.js'

/**
 * The bundled, always-available synthesized kit.
 *
 * @returns {import('../types.js').SampleKit}
 */
export function loadBundledKit() {
  const ctx = getAudioContext()
  return {
    id: 'bundled-synth',
    name: 'Starter Kit (synth)',
    buffers: renderSynthKit(ctx),
    source: 'bundled',
  }
}

/** Feature-detect local-folder support for the future folder library. */
export function supportsFolderPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

/**
 * Placeholder for the future folder-backed library. Documented here so the
 * abstraction is real; not wired into the UI in v1 beyond a feature-detect note.
 *
 * @returns {Promise<import('../types.js').SampleKit>}
 */
export async function loadFolderKit() {
  if (!supportsFolderPicker()) {
    throw new Error('Local folder selection is not supported in this browser')
  }
  // Future: const dir = await window.showDirectoryPicker(); read kick/snare/...
  throw new Error('Folder sample kits are coming next')
}

/** The kits selectable in v1 (only the bundled one is loadable today). */
export const AVAILABLE_KITS = [
  { id: 'bundled-synth', label: 'Starter Kit (synth)', available: true },
  { id: 'folder', label: 'Local folder…', available: false },
]
