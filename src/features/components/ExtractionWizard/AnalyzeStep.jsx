import { useEffect } from 'react'
import { Button, Loader, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'
import { useSettings } from '@/features/contexts/SettingsContext.jsx'
import { EXTRACTION_MODES } from '@/audio/constants.js'

import styles from './ExtractionWizard.module.css'

/**
 * AnalyzeStep — scans the selection, shows detected material with confidence %,
 * lets the user pick which stems to extract, then runs extraction directly.
 */
export function AnalyzeStep() {
  const { analysis, status, error, runAnalysis, runExtraction, goToStep } = useProject()
  const { settings, update } = useSettings()

  useEffect(() => {
    if (!analysis && status !== 'analyzing') runAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analyzing = status === 'analyzing'
  const extracting = status === 'extracting'
  const busy = analyzing || extracting

  return (
    <div className={styles.step}>
      <ParagraphXs>
        Scanning the selected window for drums, bass and lead content. Your audio never leaves the
        browser.
      </ParagraphXs>

      {/* Material detection results */}
      {(analyzing || analysis) && (
        <div className={styles.materials}>
          {analyzing ? (
            <div className={styles.analyzeLoader}>
              <Loader size={20} />
              <ParagraphXs>Analyzing…</ParagraphXs>
            </div>
          ) : (
            analysis.materials.map(m => (
              <div key={m.mode} className={cx(styles.material, !m.available && styles.materialDisabled)}>
                <span className={styles.materialName}>{labelFor(m.mode)}</span>
                <span className={styles.confLabel}>
                  {m.available
                    ? `~${Math.round(m.confidence * 100)}%`
                    : (m.note || 'Coming next')}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Extraction mode selection — wide custom checkboxes */}
      <div className={styles.modeCheckboxes}>
        {EXTRACTION_MODES.map(mode => {
          const checked = settings.extractionMode === mode.id
          return (
            <label
              key={mode.id}
              className={cx(
                styles.modeCheckbox,
                checked && styles.modeCheckboxChecked,
                !mode.available && styles.modeCheckboxDisabled,
              )}
            >
              <input
                type='checkbox'
                className={styles.modeCheckboxInput}
                checked={checked}
                disabled={!mode.available}
                onChange={() => mode.available && update({ extractionMode: mode.id })}
              />
              <span className={styles.modeCheckboxBox}>
                {checked && (
                  <svg viewBox='0 0 10 8' fill='none' className={styles.modeCheckboxMark}>
                    <path
                      d='M1 4L3.8 7L9 1'
                      stroke='currentColor'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                )}
              </span>
              <span className={styles.modeCheckboxLabel}>{mode.label}</span>
              {!mode.available && <span className={styles.modeCheckboxTag}>Coming next</span>}
            </label>
          )
        })}
      </div>

      {error && <ParagraphXs>{error}</ParagraphXs>}

      {extracting && (
        <div className={styles.analyzeLoader}>
          <Loader size={20} />
          <ParagraphXs>Extracting…</ParagraphXs>
        </div>
      )}

      <div className={styles.footer}>
        <Button label='Back' variant='outline' onClick={() => goToStep(WIZARD_STEPS.TRIM)} />
        <Button
          label={extracting ? 'Extracting…' : 'Extract pattern'}
          onClick={runExtraction}
          disabled={busy}
        />
      </div>
    </div>
  )
}

function labelFor(mode) {
  return { drums: 'Drums', bass: 'Bass melody', lead: 'Lead melody' }[mode] || mode
}
