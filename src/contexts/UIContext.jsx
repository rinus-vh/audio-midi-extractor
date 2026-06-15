import { createContext, useContext } from 'react'

/**
 * Lightweight UI-only state that several panels need to share:
 *  - whether the Sample Browser panel is open
 *  - the sample currently being dragged from the browser onto an editor lane
 *
 * Kept separate from SettingsContext (persisted-ish settings) so transient
 * interaction state doesn't pollute the settings object.
 */
export const UIContext = createContext(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
