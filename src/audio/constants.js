// Shared constants for the audio → MIDI pipeline.

/** Hard ceiling on the trimmed clip length (seconds). */
export const MAX_CLIP_SECONDS = 60

/**
 * Drum lanes, in display order (top → bottom of the grid).
 * `note` values are General MIDI percussion notes (MIDI channel 10).
 *
 * @type {import('./types.js').DrumLane[]}
 */
export const DRUM_LANES = [
  { id: 'hihat', label: 'Hi-hat',    note: 42, colorVar: '--lane-hihat' },
  { id: 'snare', label: 'Snare',     note: 38, colorVar: '--lane-snare' },
  { id: 'perc',  label: 'Perc / Other', note: 47, colorVar: '--lane-perc' },
  { id: 'kick',  label: 'Kick',      note: 36, colorVar: '--lane-kick' },
]

/** @type {Record<import('./types.js').DrumLaneId, import('./types.js').DrumLane>} */
export const DRUM_LANE_BY_ID = Object.fromEntries(DRUM_LANES.map(l => [l.id, l]))

/** Lane order used when laying out separate MIDI tracks (musical convention). */
export const MIDI_LANE_ORDER = ['kick', 'snare', 'hihat', 'perc']

/**
 * Extraction modes. Only `drums` is active in v1; the others are architecturally
 * prepared and surfaced in the UI as "coming next".
 *
 * @type {Array<{ id: import('./types.js').ExtractionMode, label: string, available: boolean }>}
 */
export const EXTRACTION_MODES = [
  { id: 'drums', label: 'Drums', available: true },
  { id: 'bass',  label: 'Bass melody', available: false },
  { id: 'lead',  label: 'Lead melody', available: false },
]

/** Quantization grid options (note denominator). */
export const QUANTIZE_GRIDS = [
  { value: '4',  label: '1/4' },
  { value: '8',  label: '1/8' },
  { value: '16', label: '1/16' },
  { value: '32', label: '1/32' },
]

/** Fallback tempo when no BPM can be estimated. */
export const DEFAULT_BPM = 120

/**
 * Minimum spacing (ms) between two hits *on the same lane*. A single drum hit
 * (especially a kick) rings out and can trip the onset detector several times in
 * a row; any same-lane onsets closer than this are merged into one. Tuned per
 * lane because a hi-hat can legitimately repeat far faster than a kick.
 *
 * @type {Record<import('./types.js').DrumLaneId, number>}
 */
export const MIN_LANE_GAP_MS = {
  kick: 110,
  snare: 90,
  perc: 80,
  hihat: 35,
}
