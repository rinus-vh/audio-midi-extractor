// MidiBuilder — converts DrumHit[] into a standard MIDI file.
//
// Zero-dependency, hand-rolled writer (isolated here so it can be swapped for a
// library later). Produces a Type-1 file with one track per drum lane by
// default, preserving per-hit velocity and microtiming. Optional quantization
// snaps onsets to a grid. Drums are written on MIDI channel 10 (index 9) using
// General MIDI percussion notes so the file drops straight into Ableton.

import { MIDI_LANE_ORDER, DRUM_LANE_BY_ID, DEFAULT_BPM } from './constants.js'
import { quantizeHits } from './quantize.js'

const TPQN = 480 // ticks per quarter note
const GATE_TICKS = 30 // short fixed note length for percussion

/**
 * @param {import('./types.js').DrumHit[]} hits
 * @param {import('./types.js').MidiExportOptions} options
 * @returns {Uint8Array}
 */
export function buildDrumMidi(hits, options) {
  const bpm = options.bpm || DEFAULT_BPM
  const prepared = options.quantize
    ? quantizeHits(hits, bpm, options.quantizeGrid, 1)
    : hits

  const secondsPerBeat = 60 / bpm
  const toTicks = (sec) => Math.max(0, Math.round((sec / secondsPerBeat) * TPQN))

  const tracks = []

  // Conductor track (tempo map) — track 0 in a Type-1 file.
  tracks.push(buildTempoTrack(bpm))

  if (options.separateTracks) {
    for (const laneId of MIDI_LANE_ORDER) {
      const laneHits = prepared.filter(h => h.lane === laneId)
      const lane = DRUM_LANE_BY_ID[laneId]
      tracks.push(buildNoteTrack(lane.label, laneHits, toTicks))
    }
  } else {
    tracks.push(buildNoteTrack('Drums', prepared, toTicks))
  }

  return assembleFile(tracks)
}

// ── Track builders ─────────────────────────────────────────────────────────

function buildTempoTrack(bpm) {
  const events = []
  const mpqn = Math.round(60000000 / bpm)
  events.push({ tick: 0, bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] })
  events.push({ tick: 0, bytes: [0xff, 0x58, 0x04, 4, 2, 24, 8] }) // 4/4 time signature
  return encodeTrack(events)
}

function buildNoteTrack(name, hits, toTicks) {
  const events = []
  // Track name meta.
  const nameBytes = [...new TextEncoder().encode(name)]
  events.push({ tick: 0, bytes: [0xff, 0x03, nameBytes.length, ...nameBytes] })

  for (const h of hits) {
    const note = DRUM_LANE_BY_ID[h.lane].note
    const onTick = toTicks(h.time)
    const velocity = clamp(h.velocity, 1, 127)
    // Channel 10 (index 9). 0x99 = note-on ch10, 0x89 = note-off ch10.
    events.push({ tick: onTick, order: 1, bytes: [0x99, note, velocity] })
    events.push({ tick: onTick + GATE_TICKS, order: 0, bytes: [0x89, note, 0x40] })
  }

  return encodeTrack(events)
}

// ── Encoding ───────────────────────────────────────────────────────────────

function encodeTrack(events) {
  // Sort by absolute tick; at equal ticks, note-offs (order 0) precede note-ons.
  events.sort((a, b) => a.tick - b.tick || (a.order ?? 0) - (b.order ?? 0))

  const out = []
  let lastTick = 0
  for (const ev of events) {
    const delta = ev.tick - lastTick
    lastTick = ev.tick
    out.push(...encodeVarLen(delta), ...ev.bytes)
  }
  out.push(...encodeVarLen(0), 0xff, 0x2f, 0x00) // end of track

  return out
}

function assembleFile(tracks) {
  const header = [
    ...strBytes('MThd'),
    ...uint32(6),
    ...uint16(1),             // format 1
    ...uint16(tracks.length), // ntracks
    ...uint16(TPQN),          // division
  ]

  const body = []
  for (const track of tracks) {
    body.push(...strBytes('MTrk'), ...uint32(track.length), ...track)
  }

  return new Uint8Array([...header, ...body])
}

// ── Byte helpers ───────────────────────────────────────────────────────────

function encodeVarLen(value) {
  let v = Math.max(0, value | 0)
  const bytes = [v & 0x7f]
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

function uint32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] }
function uint16(n) { return [(n >> 8) & 0xff, n & 0xff] }
function strBytes(s) { return [...s].map(c => c.charCodeAt(0)) }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
