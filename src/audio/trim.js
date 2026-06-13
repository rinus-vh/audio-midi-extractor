// TrimController logic — pure helpers that own the max-duration window rules.
// State itself lives in React (ProjectContext); these functions compute the
// next TrimRange given a user action. Kept pure so they're trivial to reason
// about and reuse.

import { MAX_CLIP_SECONDS } from './constants.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * The initial selection for a freshly loaded clip:
 *  - first minute selected (start 0, end 60), or
 *  - the whole clip when it's already <= 60s.
 *
 * @param {number} duration
 * @returns {import('./types.js').TrimRange}
 */
export function defaultTrimRange(duration) {
  return { start: 0, end: Math.min(duration, MAX_CLIP_SECONDS) }
}

/** Whether the trim step should auto-open (source longer than the max). */
export function shouldAutoOpenTrim(duration) {
  return duration > MAX_CLIP_SECONDS
}

export function rangeLength(range) {
  return range.end - range.start
}

/**
 * Translate the whole selection window to a new start, preserving its length.
 * The window stays glued to its length and clamps against the file end — so a
 * 60s window at start 20 becomes 20→80, and dragging toward the end stops once
 * the window's tail reaches the file duration (length is never lost).
 *
 * @param {import('./types.js').TrimRange} range
 * @param {number} newStart
 * @param {number} duration
 * @returns {import('./types.js').TrimRange}
 */
export function moveWindowTo(range, newStart, duration) {
  const length = Math.min(rangeLength(range), MAX_CLIP_SECONDS, duration)
  const start = clamp(newStart, 0, Math.max(0, duration - length))
  return { start, end: start + length }
}

/**
 * Move the start edge (left handle), keeping the end fixed. Enforces the max
 * window length by pulling the start no further left than end - MAX.
 *
 * @returns {import('./types.js').TrimRange}
 */
export function setStart(range, newStart, duration) {
  const start = clamp(newStart, Math.max(0, range.end - MAX_CLIP_SECONDS), range.end)
  return { start, end: clamp(range.end, start, duration) }
}

/**
 * Move the end edge (right handle), keeping the start fixed. Enforces the max
 * window length by capping the end at start + MAX.
 *
 * @returns {import('./types.js').TrimRange}
 */
export function setEnd(range, newEnd, duration) {
  const end = clamp(newEnd, range.start, Math.min(duration, range.start + MAX_CLIP_SECONDS))
  return { start: range.start, end }
}

/** Format seconds as m:ss.t for compact display. */
export function formatTime(seconds) {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rem = s - m * 60
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`
}
