import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, Repeat, Scissors, Square, Trash2, Wand2 } from 'lucide-react'
import { ActionIconButton, Button, FileUpload, Loader, ParagraphXs } from '@6njp/prototype-library'

import { useProject, WIZARD_STEPS } from '@/features/contexts/ProjectContext.jsx'
import { usePreview } from '@/features/contexts/PreviewContext.jsx'
import { useSettings } from '@/features/contexts/SettingsContext.jsx'
import { useUI } from '@/features/contexts/UIContext.jsx'
import { MidiTimeline } from '@/features/components/MidiTimeline/MidiTimeline.jsx'
import { Waveform } from '@/features/components/Waveform/Waveform.jsx'

import { loadSampleFromUrl, loadSampleFromHandle } from '@/audio/preview/SampleLibrary.js'
import { formatTime } from '@/audio/trim.js'

import styles from './EditorPanel.module.css'

const AUDIO_ACCEPT = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', 'audio/*']

export function EditorPanel() {
  const { clip, segment, committedSegment, displayHits, bpm, status, error, extraction, stems, loadFile, openWizard, exportMidi, reset } = useProject()
  const preview = usePreview()
  const { settings, setLaneMuted, setKitBuffer } = useSettings()
  const { getDraggedSample } = useUI()

  // Assign a sample dragged from the Sample Browser onto a drum lane.
  const handleDropSample = useCallback(async (laneId) => {
    const sample = getDraggedSample()
    if (!sample) return
    const buf = sample.url
      ? await loadSampleFromUrl(sample.url)
      : await loadSampleFromHandle(sample.handle)
    setKitBuffer(laneId, buf, sample.name)
  }, [getDraggedSample, setKitBuffer])

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
          style='transparent'
        />
        <ActionIconButton
          icon={Square}
          onClick={preview.stop}
          title='Stop'
          style='transparent'
        />
        <ActionIconButton
          icon={Repeat}
          onClick={preview.toggleLoop}
          isActive={preview.loop}
          title={preview.loop ? 'Loop on' : 'Loop off'}
          style='transparent'
        />

        <div className={styles.separator} />

        {/* File actions */}
        <ActionIconButton
          icon={Scissors}
          onClick={() => openWizard(WIZARD_STEPS.TRIM)}
          title='Re-trim'
          style='transparent'
        />
        <ActionIconButton
          icon={Trash2}
          onClick={reset}
          title='Discard file'
          style='transparent'
        />

        {/* Time readout — isolated subscriber so the playhead clock doesn't
            re-render the whole editor (and timeline) on every frame. */}
        <TimeReadout
          subscribeTime={preview.subscribeTime}
          duration={preview.duration}
        />

        {/* File name + bpm */}
        <span title={clip.name} className={styles.fileName}>{clip.name}</span>
        {extraction && <span className={styles.bpm}>~{bpm} bpm</span>}

        {/* Processing indicator */}
        {(status === 'analyzing' || status === 'extracting') && (
          <Loader size={16} layoutClassName={styles.toolbarLoader} />
        )}

        <div className={styles.spacer} />

        {/* Export */}
        {extraction && (
          <Button label='Export MIDI' icon={Download} onClick={exportMidi} />
        )}
      </div>

      {/* ── Timeline (waveform + drum grid) ──────────────────────────────── */}
      {extraction ? (
        <MidiTimeline
          mono={committedSegment?.mono ?? null}
          duration={preview.duration}
          quantizeGrid={settings.quantizeGrid}
          hits={displayHits}
          laneMuted={settings.laneMuted}
          subscribeTime={preview.subscribeTime}
          onSeek={preview.seek}
          onToggleMute={id => setLaneMuted(id, !settings.laneMuted[id])}
          onTriggerLane={preview.triggerLane}
          onDropSample={handleDropSample}
          laneSamples={settings.kitNames}
          onClearSample={id => setKitBuffer(id, null)}
          layoutClassName={styles.timeline}
          {...{ stems, bpm }}
        />
      ) : committedSegment ? (
        /* Clip loaded and trimmed but no extraction yet — show waveform with CTA */
        <div className={styles.waveEditor}>
          <Waveform
            mono={committedSegment.mono}
            duration={committedSegment.duration}
            layoutClassName={styles.previewWave}
          />
          <div className={styles.extractCta}>
            <ParagraphXs>Track loaded — extract a drum MIDI pattern from the selected window.</ParagraphXs>
            <Button label='Extract pattern' icon={Wand2} onClick={() => openWizard(WIZARD_STEPS.ANALYZE)} />
          </div>
        </div>
      ) : (
        <div className={styles.extractCta}>
          <ParagraphXs>No pattern yet — run the extraction to generate a drum MIDI pattern.</ParagraphXs>
          <Button label='Extract pattern' icon={Wand2} onClick={() => openWizard(WIZARD_STEPS.ANALYZE)} />
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
