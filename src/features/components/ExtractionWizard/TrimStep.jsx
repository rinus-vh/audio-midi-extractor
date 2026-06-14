import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { ActionIconButton, Button, ParagraphXs, Trim } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'
import { Waveform } from '@/features/components/Waveform/Waveform.jsx'

import { ClipPlayer } from '@/audio/preview/ClipPlayer.js'
import { formatTime, rangeLength } from '@/audio/trim.js'
import { MAX_CLIP_SECONDS } from '@/audio/constants.js'

import styles from './ExtractionWizard.module.css'

/**
 * TrimStep — pick the (max 60s) window to analyze. The selection can be dragged
 * by its body (moving the whole window) or resized with the edge handles, and
 * auditioned with the original audio via a ClipPlayer.
 */
export function TrimStep() {
  const { clip, trimRange, setTrimRange, goToStep } = useProject()

  const playerRef = useRef(null)
  if (playerRef.current === null) playerRef.current = new ClipPlayer()

  const [auditioning, setAuditioning] = useState(false)
  const [auditionPos, setAuditionPos] = useState(null)

  useEffect(() => {
    const player = playerRef.current
    player.setBuffer(clip.buffer)
    player.onTime = (t) => setAuditionPos(t)
    player.onEnded = () => { setAuditioning(false); setAuditionPos(null) }
    return () => player.stop()
  }, [clip])

  const toggleAudition = () => {
    const player = playerRef.current
    if (auditioning) {
      player.stop()
      setAuditioning(false)
      setAuditionPos(null)
    } else {
      player.play(trimRange.start, trimRange.end)
      setAuditioning(true)
    }
  }

  const length = rangeLength(trimRange)

  return (
    <div className={styles.step}>
      <ParagraphXs>
        Select up to {MAX_CLIP_SECONDS}s to analyze. Drag the highlighted window to move it, or drag
        its edges to resize.
      </ParagraphXs>

      <Trim
        duration={clip.duration}
        maxSelection={MAX_CLIP_SECONDS}
        selection={trimRange}
        onSelectionChange={setTrimRange}
      >
        <Waveform
          mono={clip.mono}
          duration={clip.duration}
          playhead={auditioning ? auditionPos : undefined}
          height={120}
        />
      </Trim>

      <div className={styles.trimMeta}>
        <span className={styles.mono}>
          {formatTime(trimRange.start)} – {formatTime(trimRange.end)} · {length.toFixed(1)}s
        </span>
        <ActionIconButton
          icon={auditioning ? Pause : Play}
          onClick={toggleAudition}
          isActive={auditioning}
          title={auditioning ? 'Stop audition' : 'Audition selection'}
          style='transparent'
        />
      </div>

      <div className={styles.footer}>
        <span />
        <Button label='Next: Analyze' onClick={() => goToStep(WIZARD_STEPS.ANALYZE)} />
      </div>
    </div>
  )
}
