import { useState, useRef, useCallback } from 'react'

import { UIContext } from './UIContext.jsx'

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
