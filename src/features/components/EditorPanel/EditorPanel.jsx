import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, Repeat, Scissors, Square, Trash2, Wand2 } from 'lucide-react'
import { ActionIconButton, Button, FileUpload, LabelUppercaseSm, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'
import { usePreview } from '@/features/contexts/PreviewContext.jsx'
import { useSettings } from '@/features/contexts/SettingsContext.jsx'
import { MidiTimeline } from '@/features/components/MidiTimeline/MidiTimeline.jsx'
import { formatTime } from '@/audio/trim.js'

import styles from './EditorPanel.module.css'

const AUDIO_ACCEPT = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', 'audio/*']

export function EditorPanel() {
  const { clip, segment, displayHits, bpm, status, error, extraction, loadFile, openWizard, exportMidi, reset } = useProject()
  const preview = usePreview()
  const { settings, setLaneMuted } = useSettings()

  // Spacebar play/pause.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      preview.togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview.togglePlay])

  if (!clip) {
    return (
      <div className={cx(styles.component, styles.empty)}>
        <FileUpload onFile={loadFile} label='Drop an audio file to begin' accept={AUDIO_ACCEPT} />
        {status === 'loading' && <ParagraphXs>Decoding audio…</ParagraphXs>}
        {error && <ParagraphXs>{error}</ParagraphXs>}
      </div>
    )
  }

  return (
    <div className={styles.component}>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        {/* Transport */}
        <ActionIconButton
          icon={preview.isPlaying ? Pause : Play}
          onClick={preview.togglePlay}
          isActive={preview.isPlaying}
          title={preview.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        />
        <ActionIconButton
          icon={Square}
          onClick={preview.stop}
          title='Stop'
        />
        <ActionIconButton
          icon={Repeat}
          onClick={preview.toggleLoop}
          isActive={preview.loop}
          title={preview.loop ? 'Loop on' : 'Loop off'}
        />

        <div className={styles.separator} />

        {/* File actions */}
        <ActionIconButton
          icon={Scissors}
          onClick={() => openWizard(WIZARD_STEPS.TRIM)}
          title='Re-trim'
        />
        <ActionIconButton
          icon={Trash2}
          onClick={reset}
          title='Discard file'
        />

        {/* Time readout — isolated subscriber so the playhead clock doesn't
            re-render the whole editor (and timeline) on every frame. */}
        <TimeReadout
          subscribeTime={preview.subscribeTime}
          duration={preview.duration}
        />

        {/* File name */}
        <span className={styles.fileName} title={clip.name}>{clip.name}</span>

        {/* Export */}
        {extraction && (
          <>
            <LabelUppercaseSm layoutClassName={styles.hitCount}>
              {displayHits.length} hits · ~{bpm} BPM
            </LabelUppercaseSm>
            <Button label='Export MIDI' icon={Download} onClick={exportMidi} />
          </>
        )}
      </div>

      {/* ── Timeline (waveform + drum grid) ──────────────────────────────── */}
      {extraction ? (
        <MidiTimeline
          mono={segment?.mono ?? null}
          duration={preview.duration}
          bpm={bpm}
          quantizeGrid={settings.quantizeGrid}
          hits={displayHits}
          laneMuted={settings.laneMuted}
          subscribeTime={preview.subscribeTime}
          onSeek={preview.seek}
          onToggleMute={id => setLaneMuted(id, !settings.laneMuted[id])}
          onTriggerLane={preview.triggerLane}
          layoutClassName={styles.timeline}
        />
      ) : (
        <div className={styles.extractCta}>
          {segment && (
            <div className={styles.wavePreview}>
              {/* Show a simple loading waveform placeholder until extraction is done */}
            </div>
          )}
          <ParagraphXs>No pattern yet — run the extraction to generate a drum MIDI pattern.</ParagraphXs>
          <Button label='Extract drums' icon={Wand2} onClick={() => openWizard(WIZARD_STEPS.ANALYZE)} />
        </div>
      )}
    </div>
  )
}

/**
 * TimeReadout — subscribes to the preview clock and renders the elapsed/total
 * time in isolation. Throttled to ~12fps so the clock text doesn't trigger
 * frequent re-renders of its parent. The smooth playhead lives in MidiTimeline
 * (driven imperatively).
 */
function TimeReadout({ subscribeTime, duration }) {
  const [t, setT] = useState(0)
  const lastRef = useRef(0)

  useEffect(() => {
    if (!subscribeTime) return
    return subscribeTime((next) => {
      const now = performance.now()
      if (now - lastRef.current < 80) return
      lastRef.current = now
      setT(next)
    })
  }, [subscribeTime])

  return (
    <span className={styles.time}>
      {formatTime(t)} / {formatTime(duration)}
    </span>
  )
}
