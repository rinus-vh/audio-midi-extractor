import { createContext, useContext, useState, useCallback } from 'react'

/**
 * Inspector / settings state for the extraction + preview + export pipeline.
 */
export const SETTINGS_DEFAULTS = {
  /** @type {import('@/audio/types.js').ExtractionMode} */
  extractionMode: 'drums',

  // Per-lane mute state for preview (true = silenced). `wave` mutes the
  // original-audio reference lane; the drum lanes mute their sampled hits.
  // Notes always stay visible on the timeline regardless of mute.
  laneMuted: { wave: false, kick: false, snare: false, hihat: false, perc: false },

  // When on, per-hit velocity is used for preview gain and MIDI export.
  // When off, all hits play and export at a uniform velocity (100).
  velocityDetection: true,

  // Quantization amount (0 = off, 100 = full snap). Replaces the old
  // enabled/disabled checkbox — amount 0 is equivalent to disabled.
  quantizeAmount: 0,
  quantizeGrid: '16',

  // Tempo. null = use the auto-detected BPM from extraction/analysis.
  // When the user sets this manually it overrides the detector.
  manualBpm: null,

  // Per-lane AudioBuffers for the sample preview kit. null for a lane means
  // fall back to the synthesised bundled kit for that lane.
  // NOTE: AudioBuffer is not serialisable → lives only in memory.
  kitBuffers: { kick: null, snare: null, hihat: null, perc: null },

  // Human-readable name of the sample assigned to each lane (best effort, for
  // display in the kit overview). null = using the synth fallback.
  kitNames: { kick: null, snare: null, hihat: null, perc: null },

  // Sample kit.
  kitId: 'bundled-synth',

  // Export options.
  exportSeparateTracks: true,

  // Backend selection ('auto' resolves the best available local backend).
  backendPreference: 'auto',
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)

  const update = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  const setLaneMuted = useCallback((laneId, muted) => {
    setSettings(prev => ({
      ...prev,
      laneMuted: { ...prev.laneMuted, [laneId]: muted },
    }))
  }, [])

  /** Assign a decoded AudioBuffer to a kit lane (null = revert to synth). */
  const setKitBuffer = useCallback((laneId, buffer, name = null) => {
    setSettings(prev => ({
      ...prev,
      kitBuffers: { ...prev.kitBuffers, [laneId]: buffer },
      kitNames: { ...prev.kitNames, [laneId]: buffer ? name : null },
    }))
  }, [])

  const reset = useCallback(() => setSettings(SETTINGS_DEFAULTS), [])

  return (
    <SettingsContext.Provider {...{ value: { settings, update, setLaneMuted, setKitBuffer, reset } }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
