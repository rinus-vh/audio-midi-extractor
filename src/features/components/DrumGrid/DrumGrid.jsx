import { Eye, EyeOff } from 'lucide-react'

import { DRUM_LANES } from '@/audio/constants.js'

import styles from './DrumGrid.module.css'

/**
 * DrumGrid — a compact piano-roll-style view of the extracted drum pattern.
 * One row per lane (in display order), hits drawn as bars whose height encodes
 * velocity and whose opacity encodes classification confidence. Beat/bar lines
 * give a rhythmic reference and a playhead tracks preview position.
 *
 * @param {{
 *   hits: import('@/audio/types.js').DrumHit[],
 *   duration: number,
 *   bpm: number,
 *   playhead?: number,
 *   laneVisibility: Record<string, boolean>,
 *   onToggleLane?: (laneId: string) => void,
 *   onTriggerLane?: (laneId: string) => void,
 *   layoutClassName?: string,
 * }} props
 */
export function DrumGrid({
  hits,
  duration,
  bpm,
  playhead = undefined,
  laneVisibility,
  onToggleLane = undefined,
  onTriggerLane = undefined,
  layoutClassName = undefined,
}) {
  const beatLines = buildBeatLines(duration, bpm)
  const playRatio = duration > 0 && typeof playhead === 'number' ? playhead / duration : null

  return (
    <div className={cx(styles.component, layoutClassName)}>
      {DRUM_LANES.map(lane => {
        const visible = laneVisibility?.[lane.id] !== false
        const laneHits = hits.filter(h => h.lane === lane.id)

        return (
          <div key={lane.id} className={cx(styles.lane, !visible && styles.laneMuted)}>
            <div className={styles.laneLabel}>
              <button
                type='button'
                style={{ backgroundColor: `var(${lane.colorVar})` }}
                onClick={() => onTriggerLane?.(lane.id)}
                aria-label={`Audition ${lane.label}`}
                className={styles.laneSwatch}
              />
              <span className={styles.laneName}>{lane.label}</span>
              <button
                type='button'
                onClick={() => onToggleLane?.(lane.id)}
                aria-label={visible ? `Hide ${lane.label}` : `Show ${lane.label}`}
                className={styles.laneToggle}
              >
                {visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>

            <div className={styles.track}>
              {beatLines.map(b => (
                <div
                  key={b.ratio}
                  style={{ left: `${b.ratio * 100}%` }}
                  className={cx(styles.beatLine, b.isBar && styles.barLine)}
                />
              ))}

              {visible && laneHits.map((h, i) => {
                const conf = typeof h.confidence === 'number' ? h.confidence : 1
                const heightPct = 25 + (Math.max(1, Math.min(127, h.velocity)) / 127) * 75
                
                return (
                  <div
                    key={i}
                    style={{
                      left: `${(h.time / Math.max(duration, 1e-6)) * 100}%`,
                      height: `${heightPct}%`,
                      opacity: 0.4 + conf * 0.6,
                      backgroundColor: `var(${lane.colorVar})`,
                    }}
                    title={`${lane.label} · vel ${h.velocity}${typeof h.confidence === 'number' ? ` · conf ${(conf * 100).toFixed(0)}%` : ''}`}
                    className={styles.hit}
                  />
                )
              })}

              {playRatio !== null && (
                <div style={{ left: `${playRatio * 100}%` }} className={styles.playhead} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buildBeatLines(duration, bpm) {
  if (!duration || !bpm) return []
  const secondsPerBeat = 60 / bpm
  const lines = []
  let beat = 0
  for (let t = 0; t <= duration + 1e-6; t += secondsPerBeat) {
    lines.push({ ratio: t / duration, isBar: beat % 4 === 0 })
    beat++
  }
  return lines
}
