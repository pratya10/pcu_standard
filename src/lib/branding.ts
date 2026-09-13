import { supabase } from './supabaseClient'

const LOGO_PATH = 'logo'

export function getLogoUrl(): string {
  const { data } = supabase.storage.from('branding').getPublicUrl(LOGO_PATH)
  // Cache-bust so a just-replaced logo shows immediately instead of a stale
  // browser-cached copy at the same URL.
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function uploadLogo(file: File) {
  const { error } = await supabase.storage.from('branding').upload(LOGO_PATH, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  })
  if (error) throw error
}

export async function deleteLogo() {
  const { error } = await supabase.storage.from('branding').remove([LOGO_PATH])
  if (error) throw error
}
