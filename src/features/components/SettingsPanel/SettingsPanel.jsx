import {
  Checkbox,
  Dropdown,
  Knob,
  LabelSm,
  LabelUppercaseSm,
  ParagraphXs,
  Tag,
} from '@6njp/prototype-library'

// Ordered list matching knob positions 1–4.
const GRID_STEPS = QUANTIZE_GRIDS // [{value:'4',label:'1/4'}, …, {value:'32',label:'1/32'}]
const gridToKnob = (v) => GRID_STEPS.findIndex(g => g.value === v) + 1 || 3 // default to 1/16
const knobToGrid = (k) => GRID_STEPS[Math.round(k) - 1]?.value ?? '16'

import { useSettings } from '@/features/contexts/SettingsContext.jsx'
import { useProject } from '@/features/contexts/ProjectContext.jsx'

import {
  EXTRACTION_MODES,
  QUANTIZE_GRIDS,
} from '@/audio/constants.js'
import { AVAILABLE_KITS } from '@/audio/preview/SampleLibrary.js'

import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const { settings, update } = useSettings()
  const { backendInfo, extraction, status } = useProject()

  const kitOptions = AVAILABLE_KITS.filter(k => k.available).map(k => ({ value: k.id, label: k.label }))

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

      <Section title='Detection'>
        <Checkbox
          checked={settings.velocityDetection}
          onChange={v => update({ velocityDetection: v })}
          label='Velocity detection'
        />
        <ParagraphXs>
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
        <ParagraphXs>
          Turn amount to 0 to disable quantization. Grid lines update on the track in real time.
        </ParagraphXs>
      </Section>

      <Section title='Sample kit'>
        <Dropdown
          value={settings.kitId}
          onChange={v => update({ kitId: v })}
          options={kitOptions}
        />
        <ParagraphXs>
          Local folder kits <Tag variant='normal'>Coming next</Tag>
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
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <LabelUppercaseSm>{title}</LabelUppercaseSm>
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
