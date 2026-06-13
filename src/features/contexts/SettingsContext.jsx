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

  const reset = useCallback(() => setSettings(SETTINGS_DEFAULTS), [])

  return (
    <SettingsContext.Provider {...{ value: { settings, update, setLaneMuted, reset } }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
