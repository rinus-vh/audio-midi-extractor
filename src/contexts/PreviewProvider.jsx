import { useState, useCallback, useEffect, useRef } from 'react'

import { SamplePreviewEngine } from '@/audio/preview/SamplePreviewEngine.js'
import { loadBundledKit } from '@/audio/preview/SampleLibrary.js'
import { PreviewContext } from './PreviewContext.jsx'
import { useProject } from './ProjectContext.jsx'
import { useSettings } from './SettingsContext.jsx'

export function PreviewProvider({ children }) {
  const { clip, displayHits, trimRange } = useProject()
  const { settings } = useSettings()

  // Cache the synth kit so we can mix-and-match per-lane without re-rendering it.
  // Populated lazily inside effects (never during render) so it stays clear of
  // the refs-during-render rule.
  const synthKitRef = useRef(null)

  // The engine is created exactly once via the sanctioned lazy ref-init pattern.
  const engineRef = useRef(null)
  if (engineRef.current === null) {
    engineRef.current = new SamplePreviewEngine()
  }

  const [isPlaying, setIsPlaying] = useState(false)
  const [loop, setLoopState] = useState(true)

  // Playhead is intentionally NOT React state: it ticks at 60fps and would
  // re-render the whole timeline (rebuilding grid lines + note blocks) on every
  // frame, janking the main thread badly enough to also starve the audio
  // scheduler. Instead we keep it in a ref and let consumers subscribe for
  // imperative (direct-DOM) updates. See MidiTimeline / TimeReadout.
  const playheadRef = useRef(0)
  const timeSubsRef = useRef(new Set())

  const duration = trimRange ? trimRange.end - trimRange.start : 0

  const emitTime = useCallback((t) => {
    playheadRef.current = t
    for (const fn of timeSubsRef.current) fn(t)
  }, [])

  const subscribeTime = useCallback((fn) => {
    timeSubsRef.current.add(fn)
    fn(playheadRef.current)
    return () => timeSubsRef.current.delete(fn)
  }, [])

  const getPlayhead = useCallback(() => playheadRef.current, [])

  // Wire engine callbacks and load the initial kit once.
  useEffect(() => {
    const engine = engineRef.current
    if (!synthKitRef.current) synthKitRef.current = loadBundledKit()
    engine.setKit(synthKitRef.current)
    engine.onTime = (t) => emitTime(t)
    engine.onEnded = () => { setIsPlaying(false); emitTime(0) }
    return () => engine.dispose()
  }, [emitTime])

  // Keep the engine's pattern in sync with the current display pattern.
  useEffect(() => {
    engineRef.current.setPattern(displayHits, duration)
  }, [displayHits, duration])

  // Keep the reference (original audio) buffer in sync with the loaded clip.
  useEffect(() => {
    engineRef.current.setReferenceBuffer(
      clip?.buffer ?? null,
      trimRange?.start ?? 0,
      trimRange?.end ?? 0,
    )
  }, [clip, trimRange])

  // Rebuild the kit when per-lane custom buffers change. Null lanes fall back
  // to the synthesised kit so the preview always has something to play.
  useEffect(() => {
    if (!synthKitRef.current) synthKitRef.current = loadBundledKit()
    const synth = synthKitRef.current
    const kitBuffers = settings.kitBuffers
    const buffers = {
      kick:  kitBuffers.kick  ?? synth.buffers.kick,
      snare: kitBuffers.snare ?? synth.buffers.snare,
      hihat: kitBuffers.hihat ?? synth.buffers.hihat,
      perc:  kitBuffers.perc  ?? synth.buffers.perc,
    }
    engineRef.current.setKit({ id: 'effective', name: 'Kit', buffers, source: 'mixed' })
  }, [settings.kitBuffers])

  // Loop and lane muting follow the inspector. Velocity scaling is now
  // baked into displayHits (velocityDetection off → uniform 100), so we
  // always run the engine at scale 1.
  useEffect(() => {
    engineRef.current.setLoop(loop)
  }, [loop])

  useEffect(() => {
    const muted = Object.entries(settings.laneMuted)
      .filter(([, isMuted]) => isMuted)
      .map(([laneId]) => laneId)
    engineRef.current.setMutedLanes(new Set(muted))
  }, [settings.laneMuted])

  const play = useCallback(() => {
    engineRef.current.play()
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    engineRef.current.pause()
    setIsPlaying(false)
  }, [])

  const stop = useCallback(() => {
    engineRef.current.stop()
    setIsPlaying(false)
    emitTime(0)
  }, [emitTime])

  const togglePlay = useCallback(() => {
    if (engineRef.current.playing) { pause() } else { play() }
  }, [play, pause])

  const seek = useCallback((seconds) => {
    engineRef.current.seek(seconds)
    emitTime(engineRef.current.position)
  }, [emitTime])

  const setLoop = useCallback((next) => setLoopState(Boolean(next)), [])
  const toggleLoop = useCallback(() => setLoopState(prev => !prev), [])

  /** Audition a single lane (used by the inspector / grid lane headers). */
  const triggerLane = useCallback((laneId, velocity = 100) => {
    engineRef.current.triggerLane(laneId, velocity)
  }, [])

  const value = {
    isPlaying,
    loop,
    duration,
    play,
    pause,
    stop,
    togglePlay,
    seek,
    setLoop,
    toggleLoop,
    triggerLane,
    subscribeTime,
    getPlayhead,
  }

  return <PreviewContext.Provider {...{ value }}>{children}</PreviewContext.Provider>
}
