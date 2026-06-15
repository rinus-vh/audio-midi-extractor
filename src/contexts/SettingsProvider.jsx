import { useState, useCallback } from 'react'

import { SettingsContext, SETTINGS_DEFAULTS } from './SettingsContext.jsx'

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
