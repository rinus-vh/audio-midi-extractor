// SamplePreviewEngine — Web Audio playback of a DrumHit[] pattern using a
// SampleKit. Uses a lookahead scheduler for solid timing, supports looping,
// pause/resume, per-lane muting and a global velocity scale.

import { getAudioContext } from '../decodeAudio.js'

const LOOKAHEAD_S = 0.12
const TICK_MS = 25

export class SamplePreviewEngine {
  constructor() {
    this.ctx = getAudioContext()
    /** @type {import('../types.js').SampleKit | null} */
    this.kit = null
    this.hits = []
    this.duration = 0
    this.loop = false
    this.velocityScale = 1
    this.mutedLanes = new Set()

    // Reference (original audio) playback — plays the clip segment in sync
    // with the drum pattern so the user can hear both together.
    /** @type {AudioBuffer | null} */
    this._refBuffer = null
    this._refRangeStart = 0  // seconds into the clip buffer
    this._refRangeEnd = 0
    /** @type {AudioBufferSourceNode | null} */
    this._refSource = null
    this._refGain = this.ctx.createGain()
    this._refGain.gain.value = 1
    this._refGain.connect(this.ctx.destination)

    this.playing = false
    this.offset = 0           // playhead position (s) when paused/stopped
    this.cycleStart = 0       // audio-clock time of current cycle's playhead 0
    this.hitIndex = 0
    this._interval = null
    this._raf = null
    this._sources = []
    this.onTime = null
    this.onEnded = null
  }

  setKit(kit) { this.kit = kit }

  /** Update the pattern + duration without restarting playback position. */
  setPattern(hits, duration) {
    this.hits = [...hits].sort((a, b) => a.time - b.time)
    this.duration = duration
  }

  /**
   * Provide the original clip buffer and the active trim range so the engine
   * can play the reference audio in sync with the drum pattern.
   * @param {AudioBuffer | null} buffer
   * @param {number} rangeStart  seconds into the clip buffer
   * @param {number} rangeEnd
   */
  setReferenceBuffer(buffer, rangeStart, rangeEnd) {
    this._refBuffer = buffer
    this._refRangeStart = rangeStart
    this._refRangeEnd = rangeEnd
    // If already playing, restart the reference source at the current position.
    if (this.playing) {
      this._stopRefSource()
      this._startRefSource()
    }
  }

  setLoop(loop) {
    this.loop = loop
    // Update the running reference source's loop flag without restarting.
    if (this._refSource) {
      this._refSource.loop = loop
    }
  }

  setVelocityScale(scale) { this.velocityScale = scale }

  setMutedLanes(set) {
    this.mutedLanes = new Set(set)
    // 'wave' in the muted set controls the reference audio gain.
    this._refGain.gain.value = set.has('wave') ? 0 : 1
  }

  get position() {
    if (!this.playing) return this.offset
    const elapsed = this.ctx.currentTime - this.cycleStart
    return this.loop && this.duration > 0 ? elapsed % this.duration : elapsed
  }

  play() {
    if (this.playing) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.playing = true

    // Start a hair in the future so the first events aren't dropped.
    this.cycleStart = this.ctx.currentTime + 0.06 - this.offset
    this.hitIndex = this.hits.findIndex(h => h.time >= this.offset)
    if (this.hitIndex === -1) this.hitIndex = this.hits.length

    this._interval = setInterval(() => this._schedule(), TICK_MS)
    this._schedule()
    this._startRefSource()
    this._startClock()
  }

  pause() {
    if (!this.playing) return
    this.offset = this.position
    this._teardown()
  }

  stop() {
    this.offset = 0
    this._teardown()
    this.onTime?.(0)
  }

  seek(seconds) {
    const wasPlaying = this.playing
    this._teardown()
    this.offset = Math.max(0, Math.min(seconds, this.duration))
    this.onTime?.(this.offset)
    if (wasPlaying) this.play()
  }

  /** Trigger a single lane immediately (for UI audition). */
  triggerLane(laneId, velocity = 100) {
    if (!this.kit) return
    this._trigger({ lane: laneId, velocity }, this.ctx.currentTime + 0.01)
  }

  dispose() { this._teardown() }

  // ── internals ──────────────────────────────────────────────────────────────

  _schedule() {
    if (!this.kit || this.duration <= 0) return
    const horizon = this.ctx.currentTime + LOOKAHEAD_S
    let guard = 0
    while (guard++ < 5000) {
      const hit = this.hits[this.hitIndex]
      if (!hit) {
        if (!this.loop || this.hits.length === 0) break
        this.cycleStart += this.duration
        this.hitIndex = 0
        continue
      }
      const when = this.cycleStart + hit.time
      if (when >= horizon) break
      if (when >= this.ctx.currentTime - 0.02 && !this.mutedLanes.has(hit.lane)) {
        this._trigger(hit, when)
      }
      this.hitIndex++
    }
  }

  _trigger(hit, when) {
    const buffer = this.kit?.buffers?.[hit.lane]
    if (!buffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const gain = this.ctx.createGain()
    const v = Math.max(0, Math.min(1, (hit.velocity / 127) * this.velocityScale))
    gain.gain.value = v
    src.connect(gain).connect(this.ctx.destination)
    src.start(when)
    this._sources.push(src)
    src.onended = () => {
      this._sources = this._sources.filter(s => s !== src)
    }
  }

  _startClock() {
    const loop = () => {
      if (!this.playing) return
      const pos = this.position
      this.onTime?.(pos)
      if (!this.loop && this.duration > 0 && this.ctx.currentTime - this.cycleStart >= this.duration) {
        this.stop()
        this.onEnded?.()
        return
      }
      this._raf = requestAnimationFrame(loop)
    }
    this._raf = requestAnimationFrame(loop)
  }

  _startRefSource() {
    if (!this._refBuffer || this._refRangeEnd <= this._refRangeStart) return
    this._stopRefSource()

    const src = this.ctx.createBufferSource()
    src.buffer = this._refBuffer
    src.connect(this._refGain)

    const rangeLen = this._refRangeEnd - this._refRangeStart
    // cycleStart is the audio-clock time that corresponds to pattern position 0,
    // accounting for the start-0.06 offset applied in play(). The ref source
    // must start at the same moment, offset into the clip by the current offset.
    const bufferOffset = this._refRangeStart + (this.offset % (rangeLen || 1))

    if (this.loop) {
      src.loop = true
      src.loopStart = this._refRangeStart
      src.loopEnd = this._refRangeEnd
      // Schedule start at the same wall-clock time as cycleStart, playing from
      // the right point within the loop.
      src.start(this.cycleStart, bufferOffset)
    } else {
      const remaining = this._refRangeEnd - bufferOffset
      src.start(this.cycleStart, bufferOffset, Math.max(0, remaining))
    }

    this._refSource = src
    src.onended = () => { if (this._refSource === src) this._refSource = null }
  }

  _stopRefSource() {
    if (this._refSource) {
      try { this._refSource.stop() } catch { /* already ended */ }
      this._refSource = null
    }
  }

  _teardown() {
    this.playing = false
    if (this._interval) { clearInterval(this._interval); this._interval = null }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null }
    for (const s of this._sources) { try { s.stop() } catch { /* already stopped */ } }
    this._sources = []
    this._stopRefSource()
  }
}
