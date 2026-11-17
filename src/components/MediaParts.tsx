import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Film, Image as ImageIcon, Loader2, Paperclip, Trash2, X } from 'lucide-react'
import { useAuth, useMe } from '../lib/auth'
import {
  ACCEPT_ANY,
  ACCEPT_PHOTO,
  FileProblem,
  addMedia,
  fileKind,
  loadCaseMedia,
  loadProfileMedia,
  prettySize,
  removeMedia,
  removeProfilePhoto,
  setProfilePhoto,
  type MediaItem,
} from '../lib/media'
import { Avatar, Button } from './ui'
import { useToast } from './Toast'

const say = (e: unknown) => (e instanceof FileProblem ? e.message : "Couldn't do that. Please try again.")

/* ---------- Profile photo ---------- */

export function PhotoUploader() {
  const { id, profile } = useMe()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      await setProfilePhoto(id, f)
      await refreshProfile()
      toast.success('Photo saved.')
    } catch (e) {
      toast.error(say(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await removeProfilePhoto(id)
      await refreshProfile()
    } catch (e) {
      toast.error(say(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={profile.display_name} src={profile.avatar_url} size={84} />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white" role="status" aria-label="Uploading">
            <Loader2 className="animate-spin" aria-hidden />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Your photo</p>
        <input ref={input} type="file" accept={ACCEPT_PHOTO} className="sr-only" id="photo-input" onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!min-h-10" disabled={busy} onClick={() => input.current?.click()}>
            <Camera size={16} aria-hidden /> {profile.avatar_url ? 'Change photo' : 'Add photo'}
          </Button>
          {profile.avatar_url && (
            <Button variant="ghost" className="!min-h-10" disabled={busy} onClick={remove}>Remove</Button>
          )}
        </div>
        <p className="text-xs text-muted">People see it when they swipe through matches.</p>
      </div>
    </div>
  )
}

/* ---------- Showing files ---------- */

export function MediaGallery({ items, onRemove, size = 'md' }: { items: MediaItem[]; onRemove?: (m: MediaItem) => void; size?: 'sm' | 'md' }) {
  const [view, setView] = useState<MediaItem | null>(null)
  useEffect(() => {
    if (!view) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setView(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view])
  if (items.length === 0) return null
  const box = size === 'sm' ? 'h-16 w-16' : 'h-24 w-24'
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m.id} className={`group relative ${box} overflow-hidden rounded-2xl bg-surface-2`}>
            {m.file_type === 'document' ? (
              <a href={m.url} target="_blank" rel="noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] font-semibold" aria-label={`Open ${m.name ?? 'document'}`}>
                <FileText size={size === 'sm' ? 18 : 24} aria-hidden />
                <span className="line-clamp-2 break-all">{m.name}</span>
              </a>
            ) : (
              <button onClick={() => setView(m)} className="block h-full w-full" aria-label={m.file_type === 'video' ? `Play ${m.name ?? 'video'}` : `View ${m.name ?? 'photo'}`}>
                {m.file_type === 'image' ? (
                  <img src={m.url} alt={m.name ?? 'Photo'} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-fg text-accent"><Film size={size === 'sm' ? 20 : 28} aria-hidden /></span>
                )}
              </button>
            )}
            {onRemove && (
              <button onClick={() => onRemove(m)} aria-label={`Remove ${m.name ?? 'file'}`} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-fg/80 text-bg hover:bg-fg">
                <Trash2 size={13} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {view && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setView(null)} role="dialog" aria-modal="true" aria-label={view.name ?? 'Preview'}>
          <button onClick={() => setView(null)} aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X aria-hidden /></button>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-3xl">
            {view.file_type === 'video' ? (
              <video src={view.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-2xl" />
            ) : (
              <img src={view.url} alt={view.name ?? 'Photo'} className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- Adding files to a profile or an existing problem ---------- */

export function MyMedia({ caseId, title, hint, readOnly = false }: { caseId?: string; title: string; hint: string; readOnly?: boolean }) {
  const { session } = useAuth()
  const uid = session?.user.id
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!uid) return
    const list = caseId ? await loadCaseMedia(caseId) : ((await loadProfileMedia([uid])).get(uid) ?? [])
    setItems(list)
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, caseId])

  async function add(files: FileList | null) {
    if (!files || !uid) return
    setBusy(true)
    for (const f of Array.from(files)) {
      try {
        await addMedia(uid, caseId ?? null, f)
      } catch (e) {
        toast.error(say(e))
      }
    }
    setBusy(false)
    if (input.current) input.current.value = ''
    void load()
  }

  async function remove(m: MediaItem) {
    try {
      await removeMedia(m)
      void load()
    } catch (e) {
      toast.error(say(e))
    }
  }

  if (readOnly && (!items || items.length === 0)) return null
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h3 className="font-bold">{title}</h3>
        {!readOnly && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <MediaGallery items={items ?? []} onRemove={readOnly ? undefined : remove} />
      {!readOnly && (
        <>
          <input ref={input} type="file" multiple accept={ACCEPT_ANY} className="sr-only" id={'media-input-' + (caseId ?? 'profile')} onChange={(e) => add(e.target.files)} />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <Paperclip size={16} aria-hidden /> Add photo, video or document
          </Button>
        </>
      )}
    </section>
  )
}

/* ---------- Choosing files before a problem exists (uploaded after it is saved) ---------- */

export function PendingFiles({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')

  function add(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (!fileKind(f)) {
        setNote('Some files were skipped. Use a photo, a short video or a PDF.')
        continue
      }
      if (next.length >= 5) {
        setNote('You can add up to 5 files.')
        break
      }
      next.push(f)
    }
    onChange(next)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" multiple accept={ACCEPT_ANY} className="sr-only" id="pending-files" onChange={(e) => add(e.target.files)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold shadow-card hover:bg-surface-2">
          <Paperclip size={16} aria-hidden /> Add a photo, video or document
        </button>
        <span className="text-xs text-muted">Optional. It helps people understand the job.</span>
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => {
            const k = fileKind(f)
            const I = k === 'video' ? Film : k === 'image' ? ImageIcon : FileText
            return (
              <li key={f.name + i} className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-3 pr-1.5 text-xs font-semibold">
                <I size={14} aria-hidden />
                <span className="max-w-[10rem] truncate">{f.name}</span>
                <span className="text-muted">{prettySize(f.size)}</span>
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10">
                  <X size={13} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {note && <p className="text-xs font-semibold">{note}</p>}
      {files.length > 0 && <p className="text-xs text-muted">Anyone who sees your problem can open these files. Don’t add private papers.</p>}
    </div>
  )
}
