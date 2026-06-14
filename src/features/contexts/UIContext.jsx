import { createContext, useContext, useState, useRef, useCallback } from 'react'

/**
 * Lightweight UI-only state that several panels need to share:
 *  - whether the Sample Browser panel is open
 *  - the sample currently being dragged from the browser onto an editor lane
 *
 * Kept separate from SettingsContext (persisted-ish settings) so transient
 * interaction state doesn't pollute the settings object.
 */
const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [sampleBrowserOpen, setSampleBrowserOpen] = useState(false)

  const openSampleBrowser  = useCallback(() => setSampleBrowserOpen(true), [])
  const closeSampleBrowser = useCallback(() => setSampleBrowserOpen(false), [])

  // The sample being dragged. We can't put an AudioBuffer or a
  // FileSystemFileHandle on a DataTransfer, so we stash the descriptor here and
  // read it back on drop. A ref avoids re-renders during the drag.
  const draggedSampleRef = useRef(null)
  const setDraggedSample = useCallback((sample) => { draggedSampleRef.current = sample }, [])
  const getDraggedSample = useCallback(() => draggedSampleRef.current, [])

  const value = {
    sampleBrowserOpen,
    openSampleBrowser,
    closeSampleBrowser,
    setDraggedSample,
    getDraggedSample,
  }

  return <UIContext.Provider {...{ value }}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
