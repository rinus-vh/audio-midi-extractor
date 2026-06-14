import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'

import { DRUM_LANES, QUANTIZE_GRIDS } from '@/audio/constants.js'

import styles from './MidiTimeline.module.css'

// Default visual gate durations (seconds) per lane — used only for the WIDTH
// of the note block. The actual onset is determined by the detector; the gate
// is min(time-to-next-same-lane-hit, MAX_GATE).
const MAX_GATE = { kick: 0.45, snare: 0.30, hihat: 0.12, perc: 0.25 }
const DEFAULT_GATE = 0.15

const RULER_H  = 28  // px
const WAVE_H   = 64  // px
const STEM_H   = 40  // px — compact stem waveform rows
const LANE_H   = 48  // px
const LABEL_W  = 120 // px

// Stem rows shown between the master waveform and the drum lanes.
const STEM_ROWS = [
  { id: 'stem-drums', label: 'Drums', stemKey: 'drums' },
  { id: 'stem-bass',  label: 'Bass',  stemKey: 'bass'  },
  { id: 'stem-lead',  label: 'Lead',  stemKey: 'lead'  },
]

/**
 * MidiTimeline — combined zoomable waveform + Ableton-style drum lane view.
 *
 * All rows share one horizontal axis (0 → duration). Scroll to pan, Ctrl/Cmd +
 * wheel (or pinch) to zoom. Click anywhere to seek; spacebar handled by parent.
 *
 * @param {{
 *   mono: Float32Array | null,
 *   duration: number,
 *   bpm: number,
 *   quantizeGrid: string,
 *   hits: import('@/audio/types.js').DrumHit[],
 *   laneMuted: Record<string, boolean>,
 *   subscribeTime: (fn: (t: number) => void) => () => void,
 *   onSeek: (t: number) => void,
 *   onToggleMute: (id: string) => void,
 *   onTriggerLane: (id: string) => void,
 *   onDropSample?: (laneId: string) => void,
 *   laneSamples?: Record<string, string | null>,
 *   onClearSample?: (laneId: string) => void,
 *   layoutClassName?: string,
 * }} props
 */
export function MidiTimeline({
  mono,
  stems,
  duration,
  bpm,
  quantizeGrid,
  hits,
  laneMuted,
  subscribeTime,
  onSeek,
  onToggleMute,
  onTriggerLane,
  onDropSample,
  laneSamples,
  onClearSample,
  layoutClassName,
}) {
  const [zoom, setZoom] = useState(1) // 1x → 8x
  const [dropLane, setDropLane] = useState(null) // lane id currently hovered while dragging a sample

  // Drop-target handlers for assigning a dragged sample to a lane.
  const dropProps = (laneId) => onDropSample ? {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dropLane !== laneId) setDropLane(laneId) },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropLane(prev => prev === laneId ? null : prev) },
    onDrop: (e) => { e.preventDefault(); setDropLane(null); onDropSample(laneId) },
  } : {}
  const scrollRef = useRef(null)
  const innerRef  = useRef(null)
  const labelBodyRef = useRef(null)
  const isDraggingRef = useRef(false)
  const canvasRef = useRef(null)
  // One canvas ref per stem row — stable array, never changes length.
  const stemCanvasRefs = useRef(STEM_ROWS.map(() => React.createRef()))
  const playheadRef = useRef(null)
  const [containerW, setContainerW] = useState(0)

  // ── Responsive container width ──────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const innerW = Math.max(containerW, 1) * zoom

  // ── Waveform canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    drawWaveform(canvasRef.current, { mono, innerW, height: WAVE_H })
  }, [mono, innerW])

  // ── Stem waveform canvases ──────────────────────────────────────────────────
  useEffect(() => {
    STEM_ROWS.forEach((row, i) => {
      const canvas = stemCanvasRefs.current[i]?.current
      const stemMono = stems?.[row.stemKey] ?? null
      drawWaveform(canvas, { mono: stemMono, innerW, height: STEM_H })
    })
  }, [stems, innerW])

  // ── Zoom on Ctrl/Cmd + wheel or pinch ──────────────────────────────────────
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(prev => Math.max(1, Math.min(8, prev * (e.deltaY < 0 ? 1.15 : 0.87))))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Sync label column with vertical scroll ─────────────────────────────────
  const handleScroll = useCallback((e) => {
    if (labelBodyRef.current) {
      labelBodyRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`
    }
  }, [])

  // ── Seek on click/drag ──────────────────────────────────────────────────────
  const timeFromPointer = useCallback((e) => {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect || !duration) return 0
    return Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))
  }, [duration])

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-noseek]')) return
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(timeFromPointer(e))
  }
  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return
    onSeek(timeFromPointer(e))
  }
  const handlePointerUp = () => { isDraggingRef.current = false }

  // ── Imperative playhead ───────────────────────────────────────────────────
  // Driven directly from the preview engine via subscribeTime so the timeline
  // does NOT re-render (and rebuild grid lines + notes) on every animation
  // frame. We only touch one element's transform.
  useEffect(() => {
    if (!subscribeTime) return
    const el = playheadRef.current
    return subscribeTime((t) => {
      if (!el) return
      const ratio = duration > 0 ? t / duration : 0
      el.style.left = `${ratio * 100}%`
    })
  }, [subscribeTime, duration])

  // ── Grid line positions ─────────────────────────────────────────────────────
  // Grid lines adapt to zoom: at zoom 1x only bars show, as you zoom in beats
  // appear, then subdivisions (up to the selected grid max).
  const gridLines = useMemo(
    () => buildGridLines(duration, bpm, Number(quantizeGrid), innerW),
    [duration, bpm, quantizeGrid, innerW],
  )

  const stemCount = stems ? STEM_ROWS.length : 0
  const totalH = RULER_H + WAVE_H + stemCount * STEM_H + DRUM_LANES.length * LANE_H

  return (
    <div className={cx(styles.component, layoutClassName)}>
      {/* ── Label column (fixed, scrolled via transform to match .scroll) ──── */}
      <div style={{ width: LABEL_W }} className={styles.labelCol}>
        <div className={styles.rulerLabel} />
        <div ref={labelBodyRef} className={styles.labelBody}>
          {/* Master audio reference lane */}
          <div className={cx(styles.laneLabel, styles.waveLabel)}>
            <span className={styles.laneName}>Master</span>
            <MuteButton
              muted={laneMuted?.wave === true}
              label='Master audio'
              onClick={() => onToggleMute?.('wave')}
            />
          </div>
          {/* Stem waveform rows — only shown after extraction */}
          {stems && STEM_ROWS.map((row, i) => (
            <div
              key={row.id}
              style={{ height: STEM_H }}
              className={cx(styles.laneLabel, styles.stemLabel)}
            >
              <span className={cx(styles.laneName, styles.stemName)}>{row.label}</span>
              <MuteButton
                muted={laneMuted?.[row.id] === true}
                label={`${row.label} stem`}
                onClick={() => onToggleMute?.(row.id)}
              />
            </div>
          ))}
          {DRUM_LANES.map((lane, i) => {
            const muted = laneMuted?.[lane.id] === true
            const sampleName = laneSamples?.[lane.id] ?? null
            
            return (
              <div
                key={lane.id}
                style={{ height: LANE_H }}
                className={cx(styles.laneLabel, i % 2 === 0 && styles.laneLabelAlt, dropLane === lane.id && styles.laneDropTarget)}
                {...dropProps(lane.id)}
              >
                <span
                  data-noseek
                  style={{ backgroundColor: `var(${lane.colorVar})` }}
                  onClick={() => onTriggerLane?.(lane.id)}
                  role='button'
                  tabIndex={0}
                  aria-label={`Audition ${lane.label}`}
                  className={styles.laneDot}
                />
                <span
                  title={sampleName ? `${lane.label}: ${sampleName}` : lane.label}
                  className={cx(styles.laneName, sampleName && styles.laneNameCustom)}
                >
                  {sampleName ?? lane.label}
                </span>
                {sampleName && onClearSample && (
                  <button
                    data-noseek
                    type='button'
                    onClick={() => onClearSample(lane.id)}
                    aria-label={`Remove sample from ${lane.label}`}
                    title='Remove sample — revert to synth'
                    className={styles.laneClear}
                  >
                    <X size={12} />
                  </button>
                )}
                <MuteButton
                  label={lane.label}
                  onClick={() => onToggleMute?.(lane.id)}
                  {...{ muted }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Scrollable timeline ─────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={styles.scroll}
      >
        <div ref={innerRef} style={{ width: innerW }} className={styles.inner}>
          {/* Ruler */}
          <div style={{ height: RULER_H }} className={styles.ruler}>
            {gridLines.filter(g => g.isBar).map(g => (
              <span
                key={g.ratio}
                style={{ left: `${g.ratio * 100}%` }}
                className={styles.tick}
              >
                {g.label}
              </span>
            ))}
          </div>

          {/* Master waveform */}
          <div style={{ height: WAVE_H }} className={styles.wave}>
            <canvas ref={canvasRef} className={styles.waveCanvas} />
            {gridLines.map(g => (
              <div
                key={g.ratio}
                style={{ left: `${g.ratio * 100}%` }}
                className={cx(styles.gridLine, g.isBar ? styles.gridLineBar : g.isBeat ? styles.gridLineBeat : styles.gridLineSub)}
              />
            ))}
          </div>

          {/* Stem waveform rows */}
          {stems && STEM_ROWS.map((row, i) => {
            const muted = laneMuted?.[row.id] === true
            
            return (
              <div
                key={row.id}
                style={{ height: STEM_H }}
                className={cx(styles.wave, styles.stemWave, muted && styles.stemWaveMuted)}
              >
                <canvas ref={stemCanvasRefs.current[i]} className={styles.waveCanvas} />
                {gridLines.map(g => (
                  <div
                    key={g.ratio}
                    style={{ left: `${g.ratio * 100}%` }}
                    className={cx(styles.gridLine, g.isBar ? styles.gridLineBar : g.isBeat ? styles.gridLineBeat : styles.gridLineSub)}
                  />
                ))}
              </div>
            )
          })}

          {/* Drum lanes */}
          {DRUM_LANES.map((lane, i) => {
            const muted = laneMuted?.[lane.id] === true
            const laneHits = hits.filter(h => h.lane === lane.id)
            
            return (
              <div
                key={lane.id}
                style={{ height: LANE_H }}
                className={cx(styles.lane, i % 2 === 0 && styles.laneAlt, muted && styles.laneMutedRow, dropLane === lane.id && styles.laneDropTarget)}
                {...dropProps(lane.id)}
              >
                {gridLines.map(g => (
                  <div
                    key={g.ratio}
                    style={{ left: `${g.ratio * 100}%` }}
                    className={cx(styles.gridLine, g.isBar ? styles.gridLineBar : g.isBeat ? styles.gridLineBeat : styles.gridLineSub)}
                  />
                ))}

                {laneHits.map((h, idx) => {
                  const nextHit = laneHits[idx + 1]
                  const maxGate = MAX_GATE[lane.id] ?? DEFAULT_GATE
                  const gate = nextHit
                    ? Math.min(nextHit.time - h.time, maxGate)
                    : maxGate
                  const leftPct = (h.time / Math.max(duration, 1e-6)) * 100
                  const widthPct = (gate  / Math.max(duration, 1e-6)) * 100
                  const conf = typeof h.confidence === 'number' ? h.confidence : 1
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        left: `${leftPct}%`,
                        width: `max(3px, ${widthPct}%)`,
                        opacity: 0.65 + conf * 0.35,
                        backgroundColor: `var(${lane.colorVar})`,
                      }}
                      title={`${lane.label} · vel ${h.velocity}`}
                      className={styles.note}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Playhead — spans ruler + waveform + all lanes. Position is driven
              imperatively (see subscribeTime effect) to avoid per-frame React
              re-renders of the whole timeline. */}
          <div
            ref={playheadRef}
            style={{ left: '0%', height: totalH }}
            className={styles.playhead}
          />
        </div>
      </div>
    </div>
  )
}

// ── Mute button ────────────────────────────────────────────────────────────────

function MuteButton({ muted, label, onClick }) {
  return (
    <button
      data-noseek
      type='button'
      aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
      title={muted ? `Unmute ${label}` : `Mute ${label}`}
      className={cx(styles.laneMute, muted && styles.laneMuteActive)}
      {...{ onClick }}
    >
      {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
    </button>
  )
}

// ── Grid lines ────────────────────────────────────────────────────────────────

function buildGridLines(duration, bpm, grid, innerW) {
  if (!duration || !bpm || !innerW) return []

  const secondsPerBeat = 60 / bpm
  const secondsPerBar = secondsPerBeat * 4
  const pixelsPerSecond = innerW / duration
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat
  const pixelsPerBar = pixelsPerSecond * secondsPerBar

  // Minimum pixel gap between two adjacent lines of the same type.
  const MIN_PX = 12

  // Pixel spacing between each grid level:
  //   bars   → pixelsPerBeat * 4
  //   beats  → pixelsPerBeat
  //   subs   → pixelsPerBeat / (grid / 4)  ← finer grid = smaller gap
  const pixelsPerSub = pixelsPerBeat / (grid / 4)

  // Always show bar lines (they're the coarsest and furthest apart).
  const showBeats = pixelsPerBeat >= MIN_PX
  const showSubs  = pixelsPerSub  >= MIN_PX

  const lines = []
  const secondsPerSub = secondsPerBeat * (4 / Math.max(grid, 1))
  let beat = 0

  for (let t = 0; t <= duration + 1e-6; t += secondsPerBeat, beat++) {
    // Show sub-beat subdivisions only if both conditions met:
    // 1. Spacing permits (zoom level is sufficient)
    // 2. Selected grid includes them (grid >= 4, i.e., finer than 1/4)
    if (showSubs && grid > 4) {
      for (let sub = 1; sub < grid / 4; sub++) {
        const ts = t + sub * secondsPerSub
        if (ts >= duration) break
        lines.push({
          ratio: ts / duration,
          isBar: false,
          isBeat: false,
          isSub: true,
          label: '',
        })
      }
    }

    const isBar = beat % 4 === 0
    // Always show bar lines (they're spaced 4 beats apart so always readable).
    // Show beat lines only if zoom permits.
    if (isBar || showBeats) {
      lines.push({
        ratio: t / duration,
        isBar,
        isBeat: !isBar,
        isSub: false,
        label: isBar ? `${Math.floor(beat / 4) + 1}` : '',
      })
    }
  }
  return lines
}

// ── Waveform canvas ────────────────────────────────────────────────────────────

function drawWaveform(canvas, { mono, innerW, height }) {
  if (!canvas || !innerW || !height) return
  const dpr  = window.devicePixelRatio || 1
  canvas.width  = Math.floor(innerW * dpr)
  canvas.height = Math.floor(height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, innerW, height)

  const total = mono?.length || 0
  if (!total) return

  const fg = getComputedStyle(canvas).getPropertyValue('--color').trim() || '#f4f4f4'
  const mid = height / 2
  const samplesPerPx = total / innerW

  ctx.strokeStyle = `color-mix(in srgb, ${fg} 50%, transparent)`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < innerW; x++) {
    const from = Math.floor(x * samplesPerPx)
    const to   = Math.min(total, Math.ceil((x + 1) * samplesPerPx))
    let min = 0, max = 0
    for (let i = from; i < to; i++) {
      const v = mono[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    ctx.moveTo(x + 0.5, mid - max * mid * 0.9)
    ctx.lineTo(x + 0.5, mid - min * mid * 0.9)
  }
  ctx.stroke()
}
