import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react'

import { createClipFromFile, getSegment } from '@/audio/AudioClip.js'
import { defaultTrimRange } from '@/audio/trim.js'
import { resolveBackend } from '@/audio/backends/index.js'
import { quantizeHits } from '@/audio/quantize.js'
import { buildDrumMidi } from '@/audio/midiBuilder.js'
import { downloadBlob, midiFilename } from '@/audio/download.js'
import { DEFAULT_BPM } from '@/audio/constants.js'
import { HeuristicStemProvider } from '@/audio/stemProvider.js'
import { useSettings } from './SettingsContext.jsx'

/** Wizard steps. */
export const WIZARD_STEPS = { TRIM: 1, ANALYZE: 2 }

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const { settings } = useSettings()

  const [clip, setClip] = useState(null)
  const [trimRange, setTrimRangeState] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [extraction, setExtraction] = useState(null)
  // Stem monos — computed once after extraction, keyed by stem id.
  // Each value is a Float32Array (mono signal for the trimmed window).
  const [stems, setStems] = useState(null)

  // 'idle' | 'loading' | 'analyzing' | 'extracting' | 'ready' | 'error'
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [progressStage, setProgressStage] = useState(null)
  const [backendInfo, setBackendInfo] = useState(null)

  const [wizard, setWizard] = useState({ open: false, step: WIZARD_STEPS.TRIM })

  const busyRef = useRef(false)

  const reset = useCallback(() => {
    setClip(null)
    setTrimRangeState(null)
    setAnalysis(null)
    setExtraction(null)
    setStems(null)
    setStatus('idle')
    setError(null)
    setProgressStage(null)
    setBackendInfo(null)
    setWizard({ open: false, step: WIZARD_STEPS.TRIM })
  }, [])

  const loadFile = useCallback(async (file) => {
    setStatus('loading')
    setError(null)
    setAnalysis(null)
    setExtraction(null)
    try {
      const next = await createClipFromFile(file)
      setClip(next)
      setTrimRangeState(defaultTrimRange(next.duration))
      setStatus('ready')
      setWizard({ open: true, step: WIZARD_STEPS.TRIM })
      return next
    } catch (err) {
      setError(err?.message || 'Could not decode this audio file')
      setStatus('error')
      return null
    }
  }, [])

  const setTrimRange = useCallback((range) => {
    setTrimRangeState(range)
    setAnalysis(null)
    setExtraction(null)
    setStems(null)
  }, [])

  const openWizard = useCallback((step = WIZARD_STEPS.TRIM) => {
    setWizard({ open: true, step })
  }, [])

  const goToStep = useCallback((step) => {
    setWizard(prev => ({ ...prev, step }))
  }, [])

  const closeWizard = useCallback(() => {
    setWizard(prev => ({ ...prev, open: false }))
  }, [])

  const resolvePreferredBackend = useCallback(async () => {
    const pref = settings.backendPreference === 'auto' ? undefined : settings.backendPreference
    const backend = await resolveBackend(pref)
    setBackendInfo({ id: backend.id, label: backend.label, isApproximate: backend.isApproximate })
    return backend
  }, [settings.backendPreference])

  const runAnalysis = useCallback(async () => {
    if (!clip || !trimRange || busyRef.current) return null
    busyRef.current = true
    setStatus('analyzing')
    setError(null)
    try {
      const backend = await resolvePreferredBackend()
      const summary = await backend.analyzeClip(clip, trimRange)
      setAnalysis(summary)
      setStatus('ready')
      return summary
    } catch (err) {
      setError(err?.message || 'Analysis failed')
      setStatus('error')
      return null
    } finally {
      busyRef.current = false
    }
  }, [clip, trimRange, resolvePreferredBackend])

  const runExtraction = useCallback(async () => {
    if (!clip || !trimRange || busyRef.current) return null
    busyRef.current = true
    setStatus('extracting')
    setError(null)
    setProgressStage('Preparing audio')
    try {
      const backend = await resolvePreferredBackend()
      // Use default sensitivity — the onset detector now uses energy-recovery
      // gating which removes the need for manual tuning in most cases.
      const result = await backend.extractDrums(clip, trimRange, {
        onStage: (stage) => setProgressStage(stage),
      })
      setExtraction(result)

      // Compute stem waveforms from the trimmed segment for the timeline display.
      // HeuristicStemProvider is O(N) per stem so this is fast (no ML, no FFT).
      setProgressStage('Separating stems')
      const seg = getSegment(clip, trimRange)
      const [drumStem, bassStem, leadStem] = await Promise.all([
        HeuristicStemProvider.getStem(seg, 'drums'),
        HeuristicStemProvider.getStem(seg, 'bass'),
        HeuristicStemProvider.getStem(seg, 'lead'),
      ])
      setStems({
        drums: drumStem.mono,
        bass: bassStem.mono,
        lead: leadStem.mono,
      })

      setProgressStage(null)
      setStatus('ready')
      setWizard({ open: false, step: WIZARD_STEPS.ANALYZE })
      return result
    } catch (err) {
      setError(err?.message || 'Extraction failed')
      setStatus('error')
      setProgressStage(null)
      return null
    } finally {
      busyRef.current = false
    }
  }, [clip, trimRange, resolvePreferredBackend])

  // Prefer user-set manual BPM, then fall back to auto-detected, then constant.
  const detectedBpm = extraction?.bpm || analysis?.bpm || null
  const bpm = settings.manualBpm ?? detectedBpm ?? DEFAULT_BPM

  // Hits fed to the preview engine and visual grid.
  // • quantizeAmount 0 = no snap (same as the old checkbox off)
  // • velocityDetection off = all hits at uniform velocity 100
  const displayHits = useMemo(() => {
    let hits = extraction?.hits ?? []

    if (settings.quantizeAmount > 0) {
      hits = quantizeHits(hits, bpm, Number(settings.quantizeGrid), settings.quantizeAmount / 100)
    }

    if (!settings.velocityDetection) {
      hits = hits.map(h => ({ ...h, velocity: 100 }))
    }

    return hits
  }, [extraction, settings.quantizeAmount, settings.quantizeGrid, settings.velocityDetection, bpm])

  const segment = useMemo(
    () => (clip && trimRange ? getSegment(clip, trimRange) : null),
    [clip, trimRange],
  )

  // committedSegment only updates when the wizard closes (not on every trim drag),
  // so the editor waveform doesn't redraw behind the modal on every pointer move.
  const committedSegmentRef = useRef(null)
  if (!wizard.open && segment) committedSegmentRef.current = segment
  const committedSegment = wizard.open ? committedSegmentRef.current : segment

  const exportMidi = useCallback(() => {
    if (!extraction) return
    // Export displayHits so quantization and velocity settings are baked in.
    const data = buildDrumMidi(displayHits, {
      bpm,
      separateTracks: settings.exportSeparateTracks,
      quantize: false, // already applied to displayHits if needed
      quantizeGrid: Number(settings.quantizeGrid),
    })
    downloadBlob(data, midiFilename(clip?.name), 'audio/midi')
  }, [displayHits, bpm, settings.exportSeparateTracks, settings.quantizeGrid, clip])

  const value = {
    clip,
    trimRange,
    segment,
    committedSegment,
    analysis,
    extraction,
    stems,
    displayHits,
    bpm,
    detectedBpm,
    status,
    error,
    progressStage,
    backendInfo,
    wizard,
    loadFile,
    setTrimRange,
    runAnalysis,
    runExtraction,
    openWizard,
    goToStep,
    closeWizard,
    exportMidi,
    reset,
  }

  return <ProjectContext.Provider {...{ value }}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
