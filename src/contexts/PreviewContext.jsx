import { createContext, useContext } from 'react'

/**
 * PreviewContext — owns the SamplePreviewEngine instance and mirrors its
 * transport state into React. The engine plays the (quantized) display pattern
 * through the bundled sample kit, honoring lane visibility, velocity scale and
 * loop from the settings inspector.
 */
export const PreviewContext = createContext(null)

export function usePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview must be used inside PreviewProvider')
  return ctx
}
