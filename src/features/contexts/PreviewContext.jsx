import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

import { SamplePreviewEngine } from '@/audio/preview/SamplePreviewEngine.js'
import { loadBundledKit } from '@/audio/preview/SampleLibrary.js'
import { useProject } from './ProjectContext.jsx'
import { useSettings } from './SettingsContext.jsx'

/**
 * PreviewContext — owns the SamplePreviewEngine instance and mirrors its
 * transport state into React. The engine plays the (quantized) display pattern
 * through the bundled sample kit, honoring lane visibility, velocity scale and
 * loop from the settings inspector.
 */

const PreviewContext = createContext(null)

export function PreviewProvider({ children }) {
  const { clip, displayHits, trimRange } = useProject()
  const { settings } = useSettings()

  const engineRef = useRef(null)
  if (engineRef.current === null) {
    const engine = new SamplePreviewEngine()
    engine.setKit(loadBundledKit())
    engineRef.current = engine
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

  // Wire engine callbacks once.
  useEffect(() => {
    const engine = engineRef.current
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

export function usePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview must be used inside PreviewProvider')
  return ctx
}
