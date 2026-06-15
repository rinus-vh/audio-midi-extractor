// ClipPlayer — plays a time range of a decoded AudioClip (the original audio),
// used by the Trim step to audition the selected window. Separate from the
// drum-sample preview engine, which plays the extracted pattern.

import { getAudioContext } from '@/audio/decodeAudio.js'

export class ClipPlayer {
  constructor() {
    this.ctx = getAudioContext()
    this.buffer = null
    this.source = null
    this.playing = false
    this.startedAt = 0
    this.startOffset = 0
    this.rangeEnd = 0
    this._raf = null
    this.onTime = null
    this.onEnded = null
  }

  /** @param {AudioBuffer} buffer */
  setBuffer(buffer) { this.buffer = buffer }

  /** Play [start, end] (absolute seconds in the buffer). */
  play(start, end) {
    if (!this.buffer) return
    this.stop()
    if (this.ctx.state === 'suspended') this.ctx.resume()

    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    src.connect(this.ctx.destination)
    src.start(0, start, Math.max(0, end - start))
    this.source = src
    this.playing = true
    this.startedAt = this.ctx.currentTime
    this.startOffset = start
    this.rangeEnd = end

    src.onended = () => {
      if (this.source === src) { this.playing = false; this.onEnded?.() }
    }
    this._startClock()
  }

  stop() {
    if (this.source) { try { this.source.stop() } catch { /* noop */ } this.source = null }
    this.playing = false
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null }
  }

  get position() {
    if (!this.playing) return this.startOffset
    return this.startOffset + (this.ctx.currentTime - this.startedAt)
  }

  _startClock() {
    const loop = () => {
      if (!this.playing) return
      this.onTime?.(this.position)
      this._raf = requestAnimationFrame(loop)
    }
    this._raf = requestAnimationFrame(loop)
  }
}
