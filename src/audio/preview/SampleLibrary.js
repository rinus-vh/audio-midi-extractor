// SampleLibrary — abstraction over sources of drum samples.
//
//   BundledSampleLibrary  → synthesised starter kit (always available)
//   LofiSampleLibrary     → real-sample "Lofi Kit" bundled with the app
//   FolderSampleLibrary   → user-selected local folder via File System Access API

import { getAudioContext } from '@/audio/decodeAudio.js'
import { renderSynthKit } from './synthKit.js'
// Vite resolves these at build time → hashed asset URLs.
import kickUrl  from '@/media/audio/lofi-kit/lofi-kick-1.wav?url'
import snareUrl from '@/media/audio/lofi-kit/lofi-snare-3.wav?url'
import hihatUrl from '@/media/audio/lofi-kit/lofi-hihat-4.wav?url'
import percUrl  from '@/media/audio/lofi-kit/lofi-perc-2.wav?url'

/**
 * The bundled, always-available synthesised kit.
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

/**
 * Decode a single audio URL → AudioBuffer.
 * @param {string} url
 * @returns {Promise<AudioBuffer>}
 */
export async function loadSampleFromUrl(url) {
  const ctx = getAudioContext()
  const resp = await fetch(url)
  const arrayBuf = await resp.arrayBuffer()
  return ctx.decodeAudioData(arrayBuf)
}

/**
 * Load the bundled real-sample "Lofi Kit" (fetched + decoded on first call).
 * @returns {Promise<import('../types.js').SampleKit>}
 */
export async function loadLofiKit() {
  const [kick, snare, hihat, perc] = await Promise.all([
    loadSampleFromUrl(kickUrl),
    loadSampleFromUrl(snareUrl),
    loadSampleFromUrl(hihatUrl),
    loadSampleFromUrl(percUrl),
  ])
  return {
    id: 'lofi-kit',
    name: 'Lofi Kit',
    buffers: { kick, snare, hihat, perc },
    source: 'bundled',
  }
}

/** Feature-detect local-folder support. */
export function supportsFolderPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

/**
 * Open a directory picker and return a pack structure the SampleBrowser
 * can display. Files are organised by sub-folder name; if there are no
 * sub-folders, every audio file lands in a single "All Samples" folder.
 *
 * @returns {Promise<{ id: string, name: string, folders: Record<string, Array<{ name: string, handle: FileSystemFileHandle }>> }>}
 */
export async function openFolderPack() {
  if (!supportsFolderPicker()) throw new Error('File System Access API not supported in this browser')
  const dir = await window.showDirectoryPicker({ mode: 'read' })
  const pack = { id: `folder-${Date.now()}`, name: dir.name, folders: {} }

  const AUDIO_EXT = /\.(wav|mp3|aif{1,2}|flac|ogg)$/i
  for await (const [, entry] of dir.entries()) {
    if (entry.kind === 'directory') {
      const files = []
      for await (const [, child] of entry.entries()) {
        if (child.kind === 'file' && AUDIO_EXT.test(child.name)) files.push({ name: child.name, handle: child })
      }
      if (files.length) pack.folders[entry.name] = files
    } else if (entry.kind === 'file' && AUDIO_EXT.test(entry.name)) {
      ;(pack.folders['All Samples'] ??= []).push({ name: entry.name, handle: entry })
    }
  }
  return pack
}

/** Decode a FileSystemFileHandle → AudioBuffer. */
export async function loadSampleFromHandle(handle) {
  const file = await handle.getFile()
  const arrayBuf = await file.arrayBuffer()
  const ctx = getAudioContext()
  return ctx.decodeAudioData(arrayBuf)
}

/**
 * The built-in "Lofi Kit" pack manifest used by the SampleBrowser tree.
 * Each entry has a `url` (for fetch + decode) and the default `lane` for
 * that category.
 */
export const BUILTIN_PACK = {
  id: 'lofi-kit',
  name: 'Lofi Kit',
  folders: {
    Kicks:     [{ name: 'Kick 1',         url: kickUrl,  lane: 'kick'  }],
    Snares:    [{ name: 'Snare 3',        url: snareUrl, lane: 'snare' }],
    'Hi Hats': [{ name: 'Closed Hi Hat 4', url: hihatUrl, lane: 'hihat' }],
    Percs:     [{ name: 'Other Perc 2',   url: percUrl,  lane: 'perc'  }],
  },
}

/** The kits selectable in v1. */
export const AVAILABLE_KITS = [
  { id: 'bundled-synth', label: 'Starter Kit (synth)', available: true },
  { id: 'lofi-kit',      label: 'Lofi Kit',            available: true },
]
