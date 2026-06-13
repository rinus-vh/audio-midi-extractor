import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { ActionIconButton, Button, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'
import { Waveform } from '@/features/components/Waveform/Waveform.jsx'

import { ClipPlayer } from '@/audio/preview/ClipPlayer.js'
import { setStart, setEnd, moveWindowTo, rangeLength, formatTime } from '@/audio/trim.js'
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

  // Drag handling for the body + edge handles. We grab the wrapper rect at
  // pointer-down and map clientX → seconds during the move.
  const startDrag = (mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const wrapper = e.currentTarget.parentElement
    const rect = wrapper.getBoundingClientRect()
    const startX = e.clientX
    const startRange = trimRange
    const toSeconds = (clientX) => ((clientX - rect.left) / rect.width) * clip.duration

    const onMove = (ev) => {
      const sec = toSeconds(ev.clientX)
      if (mode === 'start') setTrimRange(setStart(startRange, sec, clip.duration))
      else if (mode === 'end') setTrimRange(setEnd(startRange, sec, clip.duration))
      else {
        const delta = ((ev.clientX - startX) / rect.width) * clip.duration
        setTrimRange(moveWindowTo(startRange, startRange.start + delta, clip.duration))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startPct = (trimRange.start / clip.duration) * 100
  const endPct = (trimRange.end / clip.duration) * 100
  const length = rangeLength(trimRange)

  return (
    <div className={styles.step}>
      <ParagraphXs>
        Select up to {MAX_CLIP_SECONDS}s to analyze. Drag the highlighted window to move it, or drag
        its edges to resize.
      </ParagraphXs>

      <Waveform
        mono={clip.mono}
        duration={clip.duration}
        selection={trimRange}
        playhead={auditioning ? auditionPos : undefined}
        height={120}
      >
        <div
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          onPointerDown={startDrag('move')}
          className={styles.selectionBody}
        />
        <div
          style={{ left: `${startPct}%` }}
          onPointerDown={startDrag('start')}
          className={cx(styles.handle, styles.handleStart)}
        />
        <div
          style={{ left: `${endPct}%` }}
          onPointerDown={startDrag('end')}
          className={cx(styles.handle, styles.handleEnd)}
        />
      </Waveform>

      <div className={styles.trimMeta}>
        <span className={styles.mono}>
          {formatTime(trimRange.start)} – {formatTime(trimRange.end)} · {length.toFixed(1)}s
        </span>
        <ActionIconButton
          icon={auditioning ? Pause : Play}
          onClick={toggleAudition}
          isActive={auditioning}
          title={auditioning ? 'Stop audition' : 'Audition selection'}
        />
      </div>

      <div className={styles.footer}>
        <span />
        <Button label='Next: Analyze' onClick={() => goToStep(WIZARD_STEPS.ANALYZE)} />
      </div>
    </div>
  )
}
