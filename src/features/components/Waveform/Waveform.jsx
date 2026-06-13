import { useEffect, useRef, useState } from 'react'

import styles from './Waveform.module.css'

/**
 * Waveform — canvas peak rendering of a mono signal over its full duration,
 * with an optional selection overlay and a playhead. All times are absolute
 * seconds in the clip. Click/drag on the canvas scrubs via `onSeek`.
 *
 * Children render in an absolutely-positioned overlay sized to the canvas, so
 * callers (e.g. the trim step) can place handles using `left: %` math.
 *
 * @param {{
 *   mono: Float32Array,
 *   duration: number,
 *   playhead?: number,
 *   selection?: { start: number, end: number } | null,
 *   onSeek?: (seconds: number) => void,
 *   height?: number,
 *   layoutClassName?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export function Waveform({
  mono,
  duration,
  playhead = undefined,
  selection = null,
  onSeek = undefined,
  height = 96,
  layoutClassName = undefined,
  children = undefined,
}) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  const [width, setWidth] = useState(0)

  // Track the wrapper width so the canvas stays crisp and responsive.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    draw(canvasRef.current, { mono, duration, playhead, selection, width, height })
  }, [mono, duration, playhead, selection, width, height])

  const seekFromEvent = (e) => {
    if (!onSeek || !duration) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  const handlePointerDown = (e) => {
    if (e.target !== canvasRef.current) return // let overlay handles win
    seekFromEvent(e)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ height }}
      onPointerDown={handlePointerDown}
      className={cx(styles.component, layoutClassName)}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {children}
    </div>
  )
}

function draw(canvas, { mono, duration, playhead, selection, width, height }) {
  if (!canvas || !width || !height) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const styleOf = (name) => getComputedStyle(canvas).getPropertyValue(name).trim()
  const accent = styleOf('--interaction-color') || '#eb5a25'
  const fg = styleOf('--color') || '#f4f4f4'

  const mid = height / 2
  const total = mono?.length || 0

  // Peak-per-pixel rendering.
  if (total > 0) {
    const samplesPerPx = total / width
    ctx.strokeStyle = `color-mix(in srgb, ${fg} 45%, transparent)`
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const from = Math.floor(x * samplesPerPx)
      const to = Math.min(total, Math.floor((x + 1) * samplesPerPx))
      let min = 1
      let max = -1
      for (let i = from; i < to; i++) {
        const v = mono[i]
        if (v < min) min = v
        if (v > max) max = v
      }
      if (from >= to) { min = 0; max = 0 }
      ctx.moveTo(x + 0.5, mid - max * mid * 0.95)
      ctx.lineTo(x + 0.5, mid - min * mid * 0.95)
    }
    ctx.stroke()
  }

  // Dim everything outside the selection.
  if (selection && duration > 0) {
    const sx = (selection.start / duration) * width
    const ex = (selection.end / duration) * width
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, sx, height)
    ctx.fillRect(ex, 0, width - ex, height)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    ctx.strokeRect(sx + 0.5, 0.5, ex - sx - 1, height - 1)
  }

  // Playhead.
  if (typeof playhead === 'number' && duration > 0) {
    const px = (playhead / duration) * width
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, height)
    ctx.stroke()
  }
}
