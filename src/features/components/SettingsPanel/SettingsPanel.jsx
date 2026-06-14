import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Checkbox,
  GhostButton,
  Knob,
  PanelContainerSettingsSectionHeader,
  ParagraphXs,
  Tag,
  TextInput,
} from '@6njp/prototype-library'
import { Music, RotateCcw, Trash2 } from 'lucide-react'

// Ordered list matching knob positions 1–4.
const GRID_STEPS = QUANTIZE_GRIDS // [{value:'4',label:'1/4'}, …, {value:'32',label:'1/32'}]
const gridToKnob = (v) => GRID_STEPS.findIndex(g => g.value === v) + 1 || 3 // default to 1/16
const knobToGrid = (k) => GRID_STEPS[Math.round(k) - 1]?.value ?? '16'

import { useSettings } from '@/features/contexts/SettingsContext.jsx'
import { useProject } from '@/features/contexts/ProjectContext.jsx'
import { useUI } from '@/features/contexts/UIContext.jsx'

import {
  EXTRACTION_MODES,
  QUANTIZE_GRIDS,
} from '@/audio/constants.js'

import styles from './SettingsPanel.module.css'

// ── Tap BPM hook ────────────────────────────────────────────────────────────
function useTapBpm(onBpm) {
  const tapsRef = useRef([])

  return useCallback(() => {
    const now = Date.now()
    // Discard taps older than 3 s — user stopped tapping / new phrase.
    const recent = [...tapsRef.current.filter(t => now - t < 3000), now]
    tapsRef.current = recent.slice(-8) // keep at most 8 taps

    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i])
      const avgMs = intervals.reduce((s, v) => s + v, 0) / intervals.length
      const bpm = Math.round(60000 / avgMs)
      onBpm(Math.max(40, Math.min(240, bpm)))
    }
  }, [onBpm])
}

// ── Component ────────────────────────────────────────────────────────────────
export function SettingsPanel() {
  const { settings, update } = useSettings()
  const { backendInfo, extraction, status, bpm: effectiveBpm, detectedBpm, clip, reset } = useProject()
  const { openSampleBrowser } = useUI()

  // ── Tap BPM ─────────────────────────────────────────────────────────────
  const handleTap = useTapBpm((bpm) => update({ manualBpm: bpm }))

  // ── BPM display value ────────────────────────────────────────────────────
  // Show the manual override if set, else the effective BPM. A local text state
  // lets the user type freely (incl. intermediate values) while we only commit
  // valid in-range numbers to settings.
  const bpmDisplayValue = settings.manualBpm ?? effectiveBpm
  const [bpmText, setBpmText] = useState(String(bpmDisplayValue))
  useEffect(() => { setBpmText(String(bpmDisplayValue)) }, [bpmDisplayValue])

  const handleBpmInput = (v) => {
    setBpmText(v)
    if (v.trim() === '') { update({ manualBpm: null }); return }
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 40 && n <= 240) update({ manualBpm: n })
  }

  return (
    <div className={styles.component}>

      <Section title='Extraction mode'>
        <div className={styles.modeList}>
          {EXTRACTION_MODES.map(mode => (
            <button
              key={mode.id}
              type='button'
              disabled={!mode.available}
              onClick={() => mode.available && update({ extractionMode: mode.id })}
              className={cx(
                styles.mode,
                settings.extractionMode === mode.id && mode.available && styles.modeActive,
                !mode.available && styles.modeDisabled,
              )}
            >
              <span>{mode.label}</span>
              {!mode.available && <Tag variant='normal'>Coming next</Tag>}
            </button>
          ))}
        </div>
      </Section>

      <Section title='Tempo'>
        <div className={styles.bpmRow}>
          <TextInput
            value={bpmText}
            onChange={handleBpmInput}
            label='BPM'
            layoutClassName={styles.bpmInput}
          />
          <GhostButton
            label='Tap tempo'
            onClick={handleTap}
            layoutClassName={styles.tapBtnLayout}
          />
          {settings.manualBpm !== null && (
            <button
              onClick={() => update({ manualBpm: null })}
              title={detectedBpm ? `Reset to auto-detected ${detectedBpm} BPM` : 'Reset to auto-detected BPM'}
              className={styles.resetBpmBtn}
            >
              <RotateCcw size={12} />
              {detectedBpm ? `Auto (${detectedBpm})` : 'Auto'}
            </button>
          )}
        </div>
        <ParagraphXs layoutClassName={styles.hint}>
          {settings.manualBpm !== null
            ? 'Manual — overrides the auto-detected tempo. Tap the button or type a value.'
            : detectedBpm
              ? `Auto-detected from the audio. Override by typing or tapping.`
              : 'Will be auto-detected when you extract. You can also set it manually.'}
        </ParagraphXs>
      </Section>

      <Section title='Detection'>
        <Checkbox
          checked={settings.velocityDetection}
          onChange={v => update({ velocityDetection: v })}
          label='Velocity detection'
        />
        <ParagraphXs layoutClassName={styles.hint}>
          When on, hit strength is used for volume and MIDI velocity. When off, all
          hits play at a uniform level.
        </ParagraphXs>
      </Section>

      <Section title='Quantization'>
        <div className={styles.quantizeRow}>
          <div className={styles.knobWrap}>
            <Knob
              value={settings.quantizeAmount}
              onChange={v => update({ quantizeAmount: v })}
              min={0}
              max={100}
              step={1}
              label='Amount'
            />
          </div>
          <div className={styles.knobWrap}>
            <Knob
              normalizedValue={GRID_STEPS[gridToKnob(settings.quantizeGrid) - 1]?.label ?? '1/16'}
              value={gridToKnob(settings.quantizeGrid)}
              onChange={v => update({ quantizeGrid: knobToGrid(v) })}
              min={1}
              max={4}
              step={1}
              label='Grid steps'
            />
          </div>
        </div>
        <ParagraphXs layoutClassName={styles.hint}>
          Turn amount to 0 to disable quantization. Grid lines update on the track in real time.
        </ParagraphXs>
      </Section>

      <Section title='Sample kit'>
        <GhostButton
          label='Browse samples…'
          icon={Music}
          onClick={openSampleBrowser}
          layoutClassName={styles.browseSamplesBtnLayout}
        />
        <ParagraphXs layoutClassName={styles.hint}>
          Choose real samples for each drum lane. Any lane without a custom sample
          falls back to the built-in synth kit.
        </ParagraphXs>
      </Section>

      <Section title='Export'>
        <Checkbox
          checked={settings.exportSeparateTracks}
          onChange={v => update({ exportSeparateTracks: v })}
          label='Separate MIDI track per lane'
        />
      </Section>

      <Section title='Status / debug'>
        <dl className={styles.debug}>
          <DebugRow label='Status' value={status} />
          <DebugRow
            label='Backend'
            value={backendInfo ? `${backendInfo.label}${backendInfo.isApproximate ? ' · approx' : ''}` : '—'}
          />
          <DebugRow
            label='Pattern'
            value={extraction ? `${extraction.hits.length} hits · ${extraction.source}` : '—'}
          />
        </dl>
        {extraction?.log?.length > 0 && (
          <ul className={styles.log}>
            {extraction.log.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        )}
      </Section>

      {clip && (
        <div className={styles.bottomActions}>
          <GhostButton
            label='Discard track'
            icon={Trash2}
            color='orange'
            onClick={reset}
            layoutClassName={styles.fullButtonLayout}
          />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <PanelContainerSettingsSectionHeader {...{ title }} />
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

function DebugRow({ label, value }) {
  return (
    <div className={styles.debugRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
