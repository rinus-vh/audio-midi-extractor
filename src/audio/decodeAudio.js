// Decode an uploaded File into an AudioBuffer using the Web Audio API.
// Everything is local — the file never leaves the browser.

let sharedCtx = null

/** A lazily-created shared AudioContext (decode + playback share one). */
export function getAudioContext() {
  if (!sharedCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    sharedCtx = new Ctor()
  }
  return sharedCtx
}

/**
 * Decode a File into an AudioBuffer.
 *
 * @param {File} file
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = getAudioContext()
  // decodeAudioData copies the buffer; safe to reuse the ctx for playback later.
  return await ctx.decodeAudioData(arrayBuffer)
}

/**
 * Downmix an AudioBuffer to a single mono Float32Array (average of channels).
 *
 * @param {AudioBuffer} buffer
 * @returns {Float32Array}
 */
export function toMono(buffer) {
  const { numberOfChannels, length } = buffer
  if (numberOfChannels === 1) return buffer.getChannelData(0).slice()

  const out = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) out[i] += data[i]
  }
  const inv = 1 / numberOfChannels
  for (let i = 0; i < length; i++) out[i] *= inv
  return out
}
