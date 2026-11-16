import { supabase } from './supabaseClient'
import { getParticipantCredentials, rpcErrorMessage, unwrapRpc } from './participantSession'
import type { TopicPhoto } from '../types'

const BUCKET = 'pcu-standard-topic-evidence'
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

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// ฐานข้อมูลรับเฉพาะชื่อไฟล์ที่ลงท้าย .jpg .jpeg .png .webp · ตั้งนามสกุลจากชนิดไฟล์จริงเมื่อชื่อไม่มี/ไม่ตรง
function evidenceFileName(file: File): string {
  const ext = MIME_EXT[file.type]
  if (!ext) throw new Error('รองรับเฉพาะรูป JPG, PNG หรือ WEBP')
  const base = file.name.replace(/\.[A-Za-z0-9]+$/, '').slice(0, 200) || 'photo'
  return `${base}.${ext}`
}

function requireCredentials(roundId: string, participantId: string | null) {
  const creds = getParticipantCredentials(roundId)
  if (!creds || (participantId && creds.participantId !== participantId)) throw new Error(rpcErrorMessage('FORBIDDEN'))
  return creds
}

// 1) RPC add_topic_photo สร้างแถวและออกชื่อไฟล์ 2) อัปโหลดไปที่ชื่อนั้น (ภายใน 1 ชั่วโมง) · อัปโหลดล้ม = ลบแถวทิ้ง
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
  const creds = requireCredentials(roundId, participantId)
  const { data, error } = await supabase.rpc('add_topic_photo', {
    p_join_code: creds.joinCode,
    p_participant_id: creds.participantId,
    p_device_key: creds.deviceKey,
    p_topic_id: topicId,
    p_file_name: evidenceFileName(file),
    p_size_bytes: file.size,
    p_item_id: itemId,
  })
  const added = unwrapRpc<{ ok: boolean; id: string; file_path: string }>(data, error)

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(added.file_path, file, {
    contentType: file.type,
  })
  if (uploadErr) {
    await supabase.rpc('delete_topic_photo', {
      p_join_code: creds.joinCode,
      p_participant_id: creds.participantId,
      p_device_key: creds.deviceKey,
      p_photo_id: added.id,
    })
    throw uploadErr
  }

  const { data: row, error: rowErr } = await supabase.from('topic_photos').select('*').eq('id', added.id).single()
  if (rowErr) throw rowErr
  return row as TopicPhoto
}

// กรรมการลบได้เฉพาะรูปของตัวเองในรอบที่ยังไม่ปิด (RPC) · ผู้ดูแล (ล็อกอิน) ลบได้ทุกรูปผ่านตารางตามนโยบายผู้ดูแล
// ไฟล์ใน Storage ลบได้เฉพาะผู้ดูแล · กรรมการลบแล้วไฟล์ค้างไว้ให้ผู้ดูแลเก็บกวาด
export async function deleteTopicPhoto(photo: TopicPhoto) {
  const creds = getParticipantCredentials(photo.round_id)
  if (creds) {
    const { data, error } = await supabase.rpc('delete_topic_photo', {
      p_join_code: creds.joinCode,
      p_participant_id: creds.participantId,
      p_device_key: creds.deviceKey,
      p_photo_id: photo.id,
    })
    if (error) throw error
    if ((data as { ok?: boolean })?.ok) {
      await supabase.storage.from(BUCKET).remove([photo.file_path])
      return
    }
  }
  const { data: rows, error } = await supabase.from('topic_photos').delete().eq('id', photo.id).select('id')
  if (error) throw error
  if (!rows || rows.length === 0) throw new Error('ลบได้เฉพาะรูปที่ตนเองแนบ')
  await supabase.storage.from(BUCKET).remove([photo.file_path])
}

// เปลี่ยนรูป = เพิ่มรูปใหม่แล้วลบรูปเดิม (ฐานข้อมูลไม่ให้กรรมการแก้ชื่อไฟล์ของแถวเดิม)
export async function replaceTopicPhoto(photo: TopicPhoto, file: File): Promise<TopicPhoto> {
  if (!photo.item_id) throw new Error('รูปนี้ไม่ได้ผูกกับรายการตรวจ')
  const added = await uploadTopicPhoto({
    roundId: photo.round_id,
    topicId: photo.topic_id,
    itemId: photo.item_id,
    participantId: null,
    file,
  })
  await deleteTopicPhoto(photo)
  return added
}
