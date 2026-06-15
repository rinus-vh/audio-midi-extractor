import { ModalFlexible } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/contexts/ProjectContext.jsx'

import { TrimStep } from './TrimStep.jsx'
import { AnalyzeStep } from './AnalyzeStep.jsx'

import styles from './ExtractionWizard.module.css'

const STEP_TITLES = {
  [WIZARD_STEPS.TRIM]: 'Step 1 · Trim',
  [WIZARD_STEPS.ANALYZE]: 'Step 2 · Analyze & Extract',
}

export function ExtractionWizard() {
  const { wizard, closeWizard, clip } = useProject()

  if (!clip) return null

  return (
    <ModalFlexible isOpen={wizard.open} onClose={closeWizard} title={STEP_TITLES[wizard.step]}>
      <div className={styles.component}>
        <StepIndicator step={wizard.step} />

        {wizard.step === WIZARD_STEPS.TRIM && <TrimStep />}
        {wizard.step === WIZARD_STEPS.ANALYZE && <AnalyzeStep />}
      </div>
    </ModalFlexible>
  )
}

function StepIndicator({ step }) {
  const steps = [WIZARD_STEPS.TRIM, WIZARD_STEPS.ANALYZE]

  return (
    <div className={styles.componentStepIndicator}>
      {steps.map(s => (
        <span
          key={s}
          className={cx(styles.dot, s === step && styles.dotActive, s < step && styles.dotDone)}
        />
      ))}
    </div>
  )
}
