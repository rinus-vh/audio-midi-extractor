// Domain types for the audio → MIDI pipeline.
//
// This project follows the existing prototype conventions (plain JS + JSDoc),
// so the "types" requested in the brief live here as JSDoc typedefs. They give
// editor intellisense and a single place to read the shape of the domain model,
// while keeping the runtime dependency-free. Reference them from other modules
// with: `import('@/audio/types.js').AudioClip`.

/**
 * A decoded uploaded audio file plus the working metadata the pipeline needs.
 *
 * @typedef {Object} AudioClip
 * @property {string} id                       Stable id for this clip.
 * @property {string} name                     Original file name.
 * @property {number} size                     Original file size in bytes.
 * @property {number} duration                 Full decoded duration in seconds.
 * @property {number} sampleRate               Decoded sample rate (Hz).
 * @property {number} numberOfChannels         Decoded channel count.
 * @property {AudioBuffer} buffer              Full decoded audio buffer.
 * @property {Float32Array} mono               Full-length mono mixdown (cached).
 */

/**
 * The user-selected segment of an AudioClip. Times are absolute seconds into
 * the source file. `end - start` is always clamped to <= MAX_CLIP_SECONDS.
 *
 * @typedef {Object} TrimRange
 * @property {number} start  Selection start in seconds.
 * @property {number} end    Selection end in seconds.
 */

/**
 * A trimmed working segment derived from an AudioClip + TrimRange. This is what
 * every analysis/extraction module actually consumes.
 *
 * @typedef {Object} ClipSegment
 * @property {Float32Array} mono   Mono samples for the selected range.
 * @property {number} sampleRate   Sample rate (Hz).
 * @property {number} start        Absolute start in seconds (for reference).
 * @property {number} duration     Segment duration in seconds.
 */

/**
 * @typedef {'drums' | 'bass' | 'lead'} ExtractionMode
 */

/**
 * One detectable material type with a rough confidence and availability flag.
 *
 * @typedef {Object} MaterialDetection
 * @property {ExtractionMode} mode
 * @property {number} confidence          0..1 likelihood the material is present.
 * @property {boolean} available          Whether v1 can actually extract it.
 * @property {string} [note]              Optional human-readable status.
 */

/**
 * Result of the lightweight pre-extraction scan.
 *
 * @typedef {Object} AnalysisSummary
 * @property {MaterialDetection[]} materials
 * @property {number} [bpm]               Rough estimated tempo, if found.
 * @property {string} source             Which backend produced this ('mock' | 'heuristic' | 'python').
 */

/**
 * A single detected drum hit.
 *
 * @typedef {Object} DrumHit
 * @property {number} time          Onset time in seconds, relative to segment start.
 * @property {DrumLaneId} lane      Classified lane.
 * @property {number} velocity      MIDI velocity 1..127.
 * @property {number} [confidence]  0..1 classification confidence, if available.
 */

/**
 * @typedef {'kick' | 'snare' | 'hihat' | 'perc'} DrumLaneId
 */

/**
 * Static descriptor for a drum lane (label, color, GM note number).
 *
 * @typedef {Object} DrumLane
 * @property {DrumLaneId} id
 * @property {string} label
 * @property {number} note        General MIDI drum note (channel 10).
 * @property {string} colorVar    CSS custom property used to tint the lane.
 */

/**
 * @typedef {Object} DrumExtractionResult
 * @property {DrumHit[]} hits
 * @property {number} [bpm]
 * @property {string} source             Backend that produced it.
 * @property {boolean} isApproximate     True when produced by mock/heuristic.
 * @property {string[]} log              Stage-by-stage debug notes.
 */

/**
 * Placeholder result shape for the planned bass/lead modes.
 *
 * @typedef {Object} MelodyNote
 * @property {number} time
 * @property {number} duration
 * @property {number} midi
 * @property {number} velocity
 */

/**
 * @typedef {Object} MelodyExtractionResult
 * @property {MelodyNote[]} notes
 * @property {string} source
 * @property {boolean} isApproximate
 * @property {string[]} log
 */

/**
 * Options controlling MIDI export.
 *
 * @typedef {Object} MidiExportOptions
 * @property {boolean} separateTracks    Type-1 with one track per lane (vs single track).
 * @property {boolean} quantize          Snap onsets to the grid on export.
 * @property {number} quantizeGrid       Grid denominator (e.g. 16 = 1/16 notes).
 * @property {number} bpm                Tempo written into the file.
 * @property {boolean} preserveTiming    Keep microtiming (only meaningful when !quantize).
 */

/**
 * A loaded set of one-shot samples keyed by lane.
 *
 * @typedef {Object} SampleKit
 * @property {string} id
 * @property {string} name
 * @property {Record<DrumLaneId, AudioBuffer>} buffers
 * @property {string} source             'bundled' | 'folder'
 */

export {}
