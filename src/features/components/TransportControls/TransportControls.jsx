import { Pause, Play, Repeat, Square } from 'lucide-react'

import { formatTime } from '@/audio/trim.js'

import styles from './TransportControls.module.css'

/**
 * TransportControls — play/pause/stop, a loop toggle, a scrub bar and a time
 * readout for the sample preview. Presentational: all state comes from props.
 *
 * @param {{
 *   isPlaying: boolean,
 *   loop: boolean,
 *   playhead: number,
 *   duration: number,
 *   onTogglePlay: () => void,
 *   onStop: () => void,
 *   onToggleLoop: () => void,
 *   onSeek: (seconds: number) => void,
 *   layoutClassName?: string,
 * }} props
 */
export function TransportControls({
  isPlaying,
  loop,
  playhead,
  duration,
  onTogglePlay,
  onStop,
  onToggleLoop,
  onSeek,
  layoutClassName = undefined,
}) {
  const PlayIcon = isPlaying ? Pause : Play

  return (
    <div className={cx(styles.component, layoutClassName)}>
      <div className={styles.buttons}>
        <button
          type='button'
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={cx(styles.button, styles.primary)}
        >
          <PlayIcon size={16} />
        </button>
        <button
          type='button'
          onClick={onStop}
          aria-label='Stop'
          className={styles.button}
        >
          <Square size={15} />
        </button>
        <button
          type='button'
          onClick={onToggleLoop}
          aria-label={loop ? 'Disable loop' : 'Enable loop'}
          className={cx(styles.button, loop && styles.active)}
        >
          <Repeat size={15} />
        </button>
      </div>

      <input
        type='range'
        min={0}
        max={Math.max(duration, 0.001)}
        step={0.01}
        value={Math.min(playhead, duration)}
        onChange={e => onSeek(Number(e.target.value))}
        aria-label='Seek'
        className={styles.scrub}
      />

      <span className={styles.time}>
        {formatTime(playhead)} / {formatTime(duration)}
      </span>
    </div>
  )
}
