import { Check, Loader } from 'lucide-react'
import { Button, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'

import styles from './ExtractionWizard.module.css'

// The staged pipeline reported via `onStage` — used to render a live checklist.
const STAGES = [
  'Preparing audio',
  'Separating drums',
  'Detecting onsets',
  'Classifying hits',
  'Estimating velocities',
  'Building MIDI',
]

/**
 * ExtractStep — runs the drum extraction and shows staged progress. On success
 * the project context closes the wizard and reveals the preview in the editor.
 */
export function ExtractStep() {
  const { status, progressStage, error, extraction, runExtraction, goToStep, backendInfo } = useProject()

  const extracting = status === 'extracting'
  const currentIndex = progressStage ? STAGES.indexOf(progressStage) : -1

  return (
    <div className={styles.step}>
      <ParagraphXs>
        Transcribing drums into a MIDI pattern. Everything runs locally.
        {backendInfo?.isApproximate && ' Results are heuristic/approximate.'}
      </ParagraphXs>

      {(extracting || extraction) && (
        <ul className={styles.stages}>
          {STAGES.map((stage, i) => {
            const done = extraction ? true : i < currentIndex
            const active = extracting && i === currentIndex
            
            return (
              <li key={stage} className={cx(styles.stage, done && styles.stageDone, active && styles.stageActive)}>
                <span className={styles.stageIcon}>
                  {done ? <Check size={14} /> : active ? <Loader size={14} /> : null}
                </span>
                {stage}
              </li>
            )
          })}
        </ul>
      )}

      {error && <ParagraphXs>{error}</ParagraphXs>}

      {extraction && (
        <ParagraphXs>
          Done — {extraction.hits.length} hits{extraction.bpm ? ` · ~${extraction.bpm} BPM` : ''}.
        </ParagraphXs>
      )}

      <div className={styles.footer}>
        <Button
          label='Back'
          variant='outline'
          onClick={() => goToStep(WIZARD_STEPS.ANALYZE)}
        />
        <Button
          label={extracting ? 'Extracting…' : 'Extract drums'}
          onClick={runExtraction}
        />
      </div>
    </div>
  )
}
