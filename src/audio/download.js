// Trigger a browser download for a Blob — same anchor-click pattern used
// elsewhere in these prototypes.

/**
 * @param {BlobPart} data
 * @param {string} filename
 * @param {string} [mime]
 */
export function downloadBlob(data, filename, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Sanitize a clip name into a safe MIDI filename stem. */
export function midiFilename(clipName) {
  const stem = (clipName || 'extraction').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_')
  return `${stem}_drums.mid`
}
