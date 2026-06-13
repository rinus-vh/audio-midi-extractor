// Low-level DSP helpers shared by the heuristic pipeline.
// Deliberately FFT-free: one-pole filters + short-window RMS are cheap, robust,
// and good enough for the heuristic drum heuristics. A future ML backend can
// replace the modules that use these without touching anything else.

/**
 * One-pole low-pass filter. `cutoff` in Hz.
 * @returns {Float32Array}
 */
export function lowpass(signal, sampleRate, cutoff) {
  const out = new Float32Array(signal.length)
  const dt = 1 / sampleRate
  const rc = 1 / (2 * Math.PI * cutoff)
  const alpha = dt / (rc + dt)
  let prev = 0
  for (let i = 0; i < signal.length; i++) {
    prev += alpha * (signal[i] - prev)
    out[i] = prev
  }
  return out
}

/** High-pass = signal minus its low-passed version. */
export function highpass(signal, sampleRate, cutoff) {
  const lp = lowpass(signal, sampleRate, cutoff)
  const out = new Float32Array(signal.length)
  for (let i = 0; i < signal.length; i++) out[i] = signal[i] - lp[i]
  return out
}

/** Band-pass via difference of two low-pass filters. */
export function bandpass(signal, sampleRate, low, high) {
  const lpHigh = lowpass(signal, sampleRate, high)
  const lpLow = lowpass(signal, sampleRate, low)
  const out = new Float32Array(signal.length)
  for (let i = 0; i < signal.length; i++) out[i] = lpHigh[i] - lpLow[i]
  return out
}

/** RMS energy of a signal slice [from, to). */
export function rms(signal, from, to) {
  const a = Math.max(0, from)
  const b = Math.min(signal.length, to)
  if (b <= a) return 0
  let sum = 0
  for (let i = a; i < b; i++) sum += signal[i] * signal[i]
  return Math.sqrt(sum / (b - a))
}

/** Peak absolute amplitude of a signal slice [from, to). */
export function peak(signal, from, to) {
  const a = Math.max(0, from)
  const b = Math.min(signal.length, to)
  let p = 0
  for (let i = a; i < b; i++) { const v = Math.abs(signal[i]); if (v > p) p = v }
  return p
}

/**
 * Short-hop RMS envelope of a signal.
 * @returns {{ env: Float32Array, hop: number }} hop = samples per envelope frame.
 */
export function rmsEnvelope(signal, sampleRate, hopMs = 5, winMs = 20) {
  const hop = Math.max(1, Math.floor((hopMs / 1000) * sampleRate))
  const win = Math.max(hop, Math.floor((winMs / 1000) * sampleRate))
  const frames = Math.floor(signal.length / hop)
  const env = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    const center = f * hop
    env[f] = rms(signal, center - win / 2, center + win / 2)
  }
  return { env, hop }
}
