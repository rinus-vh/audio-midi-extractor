import { createContext, useContext } from 'react'

/** Wizard steps. */
export const WIZARD_STEPS = { TRIM: 1, ANALYZE: 2 }

export const ProjectContext = createContext(null)

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
