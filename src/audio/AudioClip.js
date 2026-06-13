// AudioClip factory + segment extraction.
//
// InputSource abstraction: v1 only has UploadedAudioSource (createClipFromFile).
// Future RecordedAudioSource / LiveInputSource can produce the same AudioClip
// shape and feed the identical downstream pipeline.

import { decodeFile, toMono } from './decodeAudio.js'

let counter = 0
const nextId = () => `clip-${Date.now()}-${counter++}`

/**
 * Build an AudioClip from an uploaded File (UploadedAudioSource).
 *
 * @param {File} file
 * @returns {Promise<import('./types.js').AudioClip>}
 */
export async function createClipFromFile(file) {
  const buffer = await decodeFile(file)
  return {
    id: nextId(),
    name: file.name,
    size: file.size,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    buffer,
    mono: toMono(buffer),
  }
}

/**
 * Slice a mono working segment for the given absolute time range.
 *
 * @param {import('./types.js').AudioClip} clip
 * @param {import('./types.js').TrimRange} range
 * @returns {import('./types.js').ClipSegment}
 */
export function getSegment(clip, range) {
  const { sampleRate, mono } = clip
  const start = Math.max(0, Math.min(range.start, clip.duration))
  const end = Math.max(start, Math.min(range.end, clip.duration))
  const startSample = Math.floor(start * sampleRate)
  const endSample = Math.floor(end * sampleRate)
  return {
    mono: mono.subarray(startSample, endSample),
    sampleRate,
    start,
    duration: end - start,
  }
}
