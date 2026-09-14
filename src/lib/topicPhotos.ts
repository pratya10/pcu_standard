import { supabase } from './supabaseClient'
import type { TopicPhoto } from '../types'

const BUCKET = 'topic-evidence'
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024
export const MAX_PHOTOS_PER_ITEM = 5

export async function listTopicPhotos(roundId: string, topicId: string): Promise<TopicPhoto[]> {
  const { data, error } = await supabase
    .from('topic_photos')
    .select('*')
    .eq('round_id', roundId)
    .eq('topic_id', topicId)
    .order('created_at')
  if (error) throw error
  return data as TopicPhoto[]
}

export async function listRoundPhotos(roundId: string): Promise<TopicPhoto[]> {
  const { data, error } = await supabase.from('topic_photos').select('*').eq('round_id', roundId).order('created_at')
  if (error) throw error
  return data as TopicPhoto[]
}

export function groupPhotosByTopicAndItem(photos: TopicPhoto[]): Map<string, Map<string, TopicPhoto[]>> {
  const byTopic = new Map<string, Map<string, TopicPhoto[]>>()
  for (const p of photos) {
    if (!p.item_id) continue
    const itemMap = byTopic.get(p.topic_id) ?? new Map<string, TopicPhoto[]>()
    const list = itemMap.get(p.item_id) ?? []
    list.push(p)
    itemMap.set(p.item_id, list)
    byTopic.set(p.topic_id, itemMap)
  }
  return byTopic
}

export function groupPhotosByItem(photos: TopicPhoto[]): Map<string, TopicPhoto[]> {
  const map = new Map<string, TopicPhoto[]>()
  for (const p of photos) {
    if (!p.item_id) continue
    const list = map.get(p.item_id) ?? []
    list.push(p)
    map.set(p.item_id, list)
  }
  return map
}

export function getTopicPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export async function uploadTopicPhoto(params: {
  roundId: string
  topicId: string
  itemId: string
  participantId: string | null
  file: File
}): Promise<TopicPhoto> {
  const { roundId, topicId, itemId, participantId, file } = params
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 30 MB')
  }
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${roundId}/${topicId}/${itemId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    contentType: file.type || 'image/jpeg',
  })
  if (uploadErr) throw uploadErr

  const { data, error } = await supabase
    .from('topic_photos')
    .insert({
      round_id: roundId,
      topic_id: topicId,
      item_id: itemId,
      uploaded_by: participantId,
      file_path: filePath,
      file_name: file.name,
      size_bytes: file.size,
    })
    .select()
    .single()
  if (error) throw error
  return data as TopicPhoto
}

export async function deleteTopicPhoto(photo: TopicPhoto) {
  await supabase.storage.from(BUCKET).remove([photo.file_path])
  const { error } = await supabase.from('topic_photos').delete().eq('id', photo.id)
  if (error) throw error
}

// Swaps the file behind an existing photo row in place (same id, same
// position in the list) instead of delete-then-reupload, mirroring how a
// comment is edited in place rather than removed and recreated.
export async function replaceTopicPhoto(photo: TopicPhoto, file: File): Promise<TopicPhoto> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 30 MB')
  }
  const ext = file.name.split('.').pop() || 'jpg'
  const newPath = `${photo.round_id}/${photo.topic_id}/${photo.item_id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(newPath, file, {
    contentType: file.type || 'image/jpeg',
  })
  if (uploadErr) throw uploadErr

  const { data, error } = await supabase
    .from('topic_photos')
    .update({ file_path: newPath, file_name: file.name, size_bytes: file.size })
    .eq('id', photo.id)
    .select()
    .single()
  if (error) throw error

  await supabase.storage.from(BUCKET).remove([photo.file_path])
  return data as TopicPhoto
}
