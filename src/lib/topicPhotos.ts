import { supabase } from './supabaseClient'
import type { TopicPhoto } from '../types'

const BUCKET = 'topic-evidence'
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024
export const MAX_PHOTOS_PER_TOPIC = 5

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

export function getTopicPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export async function uploadTopicPhoto(params: {
  roundId: string
  topicId: string
  participantId: string | null
  file: File
}): Promise<TopicPhoto> {
  const { roundId, topicId, participantId, file } = params
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 30 MB')
  }
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${roundId}/${topicId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    contentType: file.type || 'image/jpeg',
  })
  if (uploadErr) throw uploadErr

  const { data, error } = await supabase
    .from('topic_photos')
    .insert({
      round_id: roundId,
      topic_id: topicId,
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
