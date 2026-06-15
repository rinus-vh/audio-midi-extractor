import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, Play, Square, FolderPlus, GripVertical } from 'lucide-react'
import { Icon, ParagraphXs } from '@6njp/prototype-library'

import { useUI } from '@/contexts/UIContext.jsx'

import {
  BUILTIN_PACK,
  loadSampleFromUrl,
  loadSampleFromHandle,
  openFolderPack,
  supportsFolderPicker,
} from '@/audio/preview/SampleLibrary.js'
import { getAudioContext } from '@/audio/decodeAudio.js'

import styles from './SampleBrowser.module.css'

export function SampleBrowser() {
  const { setDraggedSample } = useUI()

  // ── Folders ──────────────────────────────────────────────────────────────────
  const [userPacks, setUserPacks] = useState([])

  const folders = useMemo(() => [
    ...Object.entries(BUILTIN_PACK.folders).map(([name, files]) => ({
      id: `builtin/${name}`, name, files,
    })),
    ...userPacks.flatMap(pack =>
      Object.entries(pack.folders).map(([name, files]) => ({
        id: `${pack.id}/${name}`, name: `${pack.name} · ${name}`, files,
      })),
    ),
  ], [userPacks])

  const [expanded, setExpanded] = useState(['builtin/Kicks'])

  const openFolder  = useCallback((id) => setExpanded(prev => [...new Set([...prev, id])]), [])
  const toggleFolder = useCallback((id) => setExpanded(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
  ), [])

  // ── Flat nav list: folder rows + sample rows under expanded folders ──────────
  // This drives both rendering and keyboard navigation so they always agree.
  const navItems = useMemo(() => folders.flatMap(folder => [
    { type: 'folder', id: folder.id, folder },
    ...(expanded.includes(folder.id)
      ? folder.files.map(file => ({ type: 'sample', id: `${folder.id}/${file.name}`, file }))
      : []),
  ]), [folders, expanded])

  // ── Audio preview ──────────────────────────────────────────────────────────
  const [playingKey,  setPlayingKey]  = useState(null)
  const [selectedId,  setSelectedId]  = useState(null)
  const previewSrcRef = useRef(null)

  const stopPreview = useCallback(() => {
    if (previewSrcRef.current) {
      try { previewSrcRef.current.stop() } catch { /* already ended */ }
      previewSrcRef.current = null
    }
    setPlayingKey(null)
  }, [])

  const previewFile = useCallback(async (file, key, { toggle = false } = {}) => {
    const wasPlaying = key === playingKey
    stopPreview()
    if (toggle && wasPlaying) return
    const buf = file.url
      ? await loadSampleFromUrl(file.url)
      : await loadSampleFromHandle(file.handle)
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
    previewSrcRef.current = src
    setPlayingKey(key)
    src.onended = () => {
      if (previewSrcRef.current === src) { previewSrcRef.current = null; setPlayingKey(null) }
    }
  }, [playingKey, stopPreview])

  useEffect(() => () => stopPreview(), [stopPreview])

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  // Arrows walk the full navItems list (folders + samples). Landing on a folder
  // auto-opens it so the next arrow immediately steps into its samples.
  // Space / Enter toggles preview of the currently selected sample.
  const onKeyDown = useCallback((e) => {
    if (!navItems.length) return

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      const item = navItems.find(i => i.id === selectedId)
      if (item?.type === 'sample') previewFile(item.file, item.id, { toggle: true })
      if (item?.type === 'folder') toggleFolder(item.id)
      return
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()

    const dir = e.key === 'ArrowDown' ? 1 : -1
    const cur = navItems.findIndex(i => i.id === selectedId)
    const nextIdx = cur < 0
      ? 0
      : Math.max(0, Math.min(navItems.length - 1, cur + dir))
    const next = navItems[nextIdx]
    if (!next) return

    setSelectedId(next.id)

    if (next.type === 'folder') {
      // Auto-open the folder so the next keypress steps straight into its samples.
      if (next.folder.files.length > 0) openFolder(next.id)
    } else {
      previewFile(next.file, next.id)
    }
  }, [navItems, selectedId, previewFile, toggleFolder, openFolder])

  // ── Open local folder ────────────────────────────────────────────────────────
  const [folderError, setFolderError] = useState(null)
  const handleOpenFolder = async () => {
    setFolderError(null)
    try {
      const pack = await openFolderPack()
      setUserPacks(prev => [...prev.filter(p => p.id !== pack.id), pack])
      const firstFolder = Object.keys(pack.folders)[0]
      if (firstFolder) openFolder(`${pack.id}/${firstFolder}`)
    } catch (err) {
      if (err.name !== 'AbortError') setFolderError(err.message)
    }
  }

  return (
    <div className={styles.component}>
      <div
        tabIndex={0}
        role='tree'
        aria-label='Samples'
        className={styles.tree}
        {...{ onKeyDown }}
      >
        {folders.map(folder => {
          const open = expanded.includes(folder.id)
          const isFolderSelected = selectedId === folder.id
          
          return (
            <div key={folder.id}>
              <button
                onClick={() => toggleFolder(folder.id)}
                className={cx(
                  styles.folderRow,
                  open && styles.folderRowOpen,
                  isFolderSelected && styles.folderRowSelected,
                )}
              >
                {open
                  ? <Icon icon={ChevronDown} layoutClassName={styles.chevronLayout} />
                  : <Icon icon={ChevronRight} layoutClassName={styles.chevronLayout} />}
                <Icon icon={Folder} layoutClassName={styles.folderIconLayout} />
                <span className={styles.folderName}>{folder.name}</span>
                <span className={styles.folderCount}>{folder.files.length}</span>
              </button>

              {open && folder.files.map(file => {
                const key = `${folder.id}/${file.name}`
                const isPlaying  = playingKey === key
                const isSelected = selectedId === key
                
                return (
                  <div
                    draggable
                    key={file.name}
                    role='treeitem'
                    aria-selected={isSelected}
                    onDragStart={(e) => {
                      setDraggedSample(file)
                      e.dataTransfer.effectAllowed = 'copy'
                      e.dataTransfer.setData('text/plain', file.name)
                    }}
                    onDragEnd={() => setDraggedSample(null)}
                    onClick={() => { setSelectedId(key); previewFile(file, key, { toggle: true }) }}
                    title='Click to preview · drag onto a lane in the editor to assign'
                    className={cx(styles.sampleRow, isSelected && styles.sampleRowSelected)}
                  >
                    <span className={cx(styles.samplePreviewBtn, isPlaying && styles.samplePreviewBtnActive)}>
                      {isPlaying ? <Square size={9} fill='currentColor' /> : <Play size={9} fill='currentColor' />}
                    </span>
                    <span className={styles.sampleName}>{file.name}</span>
                    <Icon icon={GripVertical} layoutClassName={styles.gripIconLayout} />
                  </div>
                )
              })}
            </div>
          )
        })}

        {supportsFolderPicker() && (
          <button onClick={handleOpenFolder} className={styles.openFolderBtn}>
            <FolderPlus size={13} />
            Open folder…
          </button>
        )}
        {folderError && <ParagraphXs layoutClassName={styles.errorLayout}>{folderError}</ParagraphXs>}
      </div>
    </div>
  )
}
