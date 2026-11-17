import { supabase } from './supabase'

export type FileKind = 'image' | 'video' | 'document'

export interface MediaItem {
  id: string
  owner_id: string
  kind: 'profile' | 'problem'
  case_id: string | null
  url: string
  path: string
  file_type: FileKind
  name: string | null
  size_bytes: number | null
}

/** A problem a person can understand and fix, shown in plain words. */
export class FileProblem extends Error {}

export const ACCEPT_PHOTO = 'image/jpeg,image/png,image/webp'
export const ACCEPT_ANY = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.txt'

const MB = 1024 * 1024
const MAX: Record<FileKind, number> = { image: 12 * MB, video: 20 * MB, document: 10 * MB }

export function fileKind(f: File): FileKind | null {
  if (/^image\/(jpeg|png|webp)$/.test(f.type)) return 'image'
  if (/^video\/(mp4|webm|quicktime)$/.test(f.type)) return 'video'
  if (f.type === 'application/pdf' || f.type === 'text/plain' || /\.(docx?|pdf|txt)$/i.test(f.name)) return 'document'
  return null
}

/** Shrinks big photos so they load fast: longest side 1200 px, saved as JPEG. */
async function shrinkImage(file: File, max: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

async function upload(bucket: 'avatars' | 'media', uid: string, blob: Blob, ext: string, contentType: string): Promise<string> {
  const path = `${uid}/${rid()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: false })
  if (error) throw new FileProblem("Couldn't upload that file. Please try again.")
  return path
}

/** Sets or replaces the profile photo. */
export async function setProfilePhoto(uid: string, file: File): Promise<string> {
  if (fileKind(file) !== 'image') throw new FileProblem('Please choose a photo (JPG, PNG or WebP).')
  if (file.size > MAX.image) throw new FileProblem('That photo is too big. Please choose one under 12 MB.')
  const blob = await shrinkImage(file, 800)
  const path = await upload('avatars', uid, blob, 'jpg', blob.type || 'image/jpeg')
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid)
  if (error) throw new FileProblem("Couldn't save your photo. Please try again.")
  return url
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid)
  if (error) throw new FileProblem("Couldn't remove your photo. Please try again.")
}

/** Adds a photo, video or document to a profile (caseId null) or to a problem. */
export async function addMedia(uid: string, caseId: string | null, file: File): Promise<MediaItem> {
  const kind = fileKind(file)
  if (!kind) throw new FileProblem('That file type is not allowed. Use a photo, a short video or a PDF.')
  if (file.size > MAX[kind]) throw new FileProblem(kind === 'video' ? 'That video is too big. Videos can be up to 20 MB.' : 'That file is too big.')
  let blob: Blob = file
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5)
  let type = file.type || 'application/octet-stream'
  if (kind === 'image') {
    blob = await shrinkImage(file, 1400)
    ext = 'jpg'
    type = blob.type || 'image/jpeg'
  }
  const path = await upload('media', uid, blob, ext, type)
  const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  const { data, error } = await supabase
    .from('media')
    .insert({ owner_id: uid, kind: caseId ? 'problem' : 'profile', case_id: caseId, url, path, file_type: kind, name: file.name.slice(0, 200), size_bytes: blob.size })
    .select('*')
    .single()
  if (error) {
    await supabase.storage.from('media').remove([path])
    const limit = /up to (8|5) files/.exec(error.message)
    throw new FileProblem(limit ? `You can add up to ${limit[1]} files here.` : "Couldn't add that file. Please try again.")
  }
  return data as MediaItem
}

export async function removeMedia(item: MediaItem): Promise<void> {
  const { error } = await supabase.from('media').delete().eq('id', item.id)
  if (error) throw new FileProblem("Couldn't remove that file. Please try again.")
  await supabase.storage.from('media').remove([item.path])
}

/** Files shown on helpers' profiles. Empty (not an error) if files are not switched on yet. */
export async function loadProfileMedia(ownerIds: string[]): Promise<Map<string, MediaItem[]>> {
  const map = new Map<string, MediaItem[]>()
  const ids = [...new Set(ownerIds)].filter(Boolean)
  if (!ids.length) return map
  const { data, error } = await supabase.from('media').select('*').eq('kind', 'profile').in('owner_id', ids).order('created_at')
  if (error || !data) return map
  for (const m of data as MediaItem[]) map.set(m.owner_id, [...(map.get(m.owner_id) ?? []), m])
  return map
}

export async function loadCaseMedia(caseId: string): Promise<MediaItem[]> {
  const { data, error } = await supabase.from('media').select('*').eq('case_id', caseId).order('created_at')
  return error || !data ? [] : (data as MediaItem[])
}

export const prettySize = (b: number | null) => (b == null ? '' : b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
