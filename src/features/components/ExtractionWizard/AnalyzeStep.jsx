import { useEffect } from 'react'
import { Button, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'

import styles from './ExtractionWizard.module.css'

/**
 * AnalyzeStep — runs the pre-extraction scan and reports which material types
 * were detected with rough confidences. Only drums is actionable in v1; bass
 * and lead are surfaced as "coming next".
 */
export function AnalyzeStep() {
  const { analysis, status, error, runAnalysis, goToStep, backendInfo } = useProject()

  // Run once on entering the step (if not already analyzed for this window).
  useEffect(() => {
    if (!analysis && status !== 'analyzing') runAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analyzing = status === 'analyzing'

  return (
    <div className={styles.step}>
      <ParagraphXs>
        Scanning the selected window for drums, bass and lead content. This runs locally — your audio
        never leaves the browser.
      </ParagraphXs>

      {analyzing && <ParagraphXs>Analyzing…</ParagraphXs>}
      {error && <ParagraphXs>{error}</ParagraphXs>}

      {analysis && (
        <>
          <div className={styles.materials}>
            {analysis.materials.map(m => (
              <div key={m.mode} className={cx(styles.material, !m.available && styles.materialDisabled)}>
                <span className={styles.materialName}>{labelFor(m.mode)}</span>
                <span className={styles.confBar}>
                  <span style={{ width: `${Math.round(m.confidence * 100)}%` }} className={styles.confFill} />
                </span>
                <span className={styles.confLabel}>
                  {m.available ? confidenceLabel(m.confidence) : (m.note || 'Coming next')}
                </span>
              </div>
            ))}
          </div>

          <ParagraphXs>
            Estimated tempo: {analysis.bpm ? `~${analysis.bpm} BPM` : 'unknown'}
            {backendInfo ? ` · backend: ${backendInfo.label}${backendInfo.isApproximate ? ' (approximate)' : ''}` : ''}
          </ParagraphXs>
        </>
      )}

      <div className={styles.footer}>
        <Button label='Back' variant='outline' onClick={() => goToStep(WIZARD_STEPS.TRIM)} />
        <Button label='Next: Extract' onClick={() => goToStep(WIZARD_STEPS.EXTRACT)} />
      </div>
    </div>
  )
}

function labelFor(mode) {
  return { drums: 'Drums', bass: 'Bass melody', lead: 'Lead melody' }[mode] || mode
}

function confidenceLabel(c) {
  if (c >= 0.66) return 'High'
  if (c >= 0.33) return 'Medium'
  return 'Low'
}
