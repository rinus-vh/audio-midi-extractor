import { ModalFlexible } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'

import { TrimStep } from './TrimStep.jsx'
import { AnalyzeStep } from './AnalyzeStep.jsx'
import { ExtractStep } from './ExtractStep.jsx'

import styles from './ExtractionWizard.module.css'

const STEP_TITLES = {
  [WIZARD_STEPS.TRIM]: 'Step 1 · Trim',
  [WIZARD_STEPS.ANALYZE]: 'Step 2 · Analyze',
  [WIZARD_STEPS.EXTRACT]: 'Step 3 · Extract',
}

/**
 * ExtractionWizard — the upload → trim → analyze → extract flow shown after a
 * file is loaded. Each step is its own component; this shell owns the modal
 * chrome and the step indicator.
 */
export function ExtractionWizard() {
  const { wizard, closeWizard, clip } = useProject()

  if (!clip) return null

  return (
    <ModalFlexible isOpen={wizard.open} onClose={closeWizard} title={STEP_TITLES[wizard.step]}>
      <div className={styles.component}>
        <StepIndicator step={wizard.step} />

        {wizard.step === WIZARD_STEPS.TRIM && <TrimStep />}
        {wizard.step === WIZARD_STEPS.ANALYZE && <AnalyzeStep />}
        {wizard.step === WIZARD_STEPS.EXTRACT && <ExtractStep />}
      </div>
    </ModalFlexible>
  )
}

function StepIndicator({ step }) {
  const steps = [WIZARD_STEPS.TRIM, WIZARD_STEPS.ANALYZE, WIZARD_STEPS.EXTRACT]
  
  return (
    <div className={styles.indicator}>
      {steps.map(s => (
        <span
          key={s}
          className={cx(styles.dot, s === step && styles.dotActive, s < step && styles.dotDone)}
        />
      ))}
    </div>
  )
}
