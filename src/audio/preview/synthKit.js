// synthKit — procedurally renders a bundled starter drum kit to AudioBuffers
// using Web Audio. No binary assets, fully offline. Each lane is a short
// one-shot synthesized to be recognizable (kick/snare/hat/perc).

/**
 * Render the full bundled kit.
 *
 * @param {BaseAudioContext} ctx
 * @returns {Record<import('../types.js').DrumLaneId, AudioBuffer>}
 */
export function renderSynthKit(ctx) {
  return {
    kick: renderKick(ctx),
    snare: renderSnare(ctx),
    hihat: renderHihat(ctx),
    perc: renderPerc(ctx),
  }
}

function makeBuffer(ctx, seconds) {
  const sr = ctx.sampleRate
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * sr), sr)
  return { buffer, data: buffer.getChannelData(0), sr }
}

function renderKick(ctx) {
  const { buffer, data, sr } = makeBuffer(ctx, 0.35)
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const freq = 120 * Math.exp(-t * 28) + 45 // pitch drop
    const env = Math.exp(-t * 9)
    data[i] = Math.sin(2 * Math.PI * freq * t) * env
  }
  return buffer
}

function renderSnare(ctx) {
  const { buffer, data, sr } = makeBuffer(ctx, 0.25)
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const noise = Math.random() * 2 - 1
    const tone = Math.sin(2 * Math.PI * 185 * t)
    const env = Math.exp(-t * 22)
    data[i] = (noise * 0.7 + tone * 0.3) * env
  }
  return buffer
}

function renderHihat(ctx) {
  const { buffer, data, sr } = makeBuffer(ctx, 0.08)
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const noise = Math.random() * 2 - 1
    const env = Math.exp(-t * 80)
    data[i] = noise * env * 0.6
  }
  return buffer
}

function renderPerc(ctx) {
  const { buffer, data, sr } = makeBuffer(ctx, 0.18)
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const tone = Math.sin(2 * Math.PI * 380 * t) + 0.5 * Math.sin(2 * Math.PI * 540 * t)
    const env = Math.exp(-t * 30)
    data[i] = tone * env * 0.5
  }
  return buffer
}
