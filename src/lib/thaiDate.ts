const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

// Formats an ISO date string (YYYY-MM-DD) as a Thai Buddhist-era date, e.g.
// "19 กันยายน พ.ศ. 2569". Returns the fallback text when there is no date.
export function formatThaiDate(iso: string | null | undefined, fallback = '-'): string {
  if (!iso) return fallback
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d || !THAI_MONTHS[m - 1]) return iso
  return `${d} ${THAI_MONTHS[m - 1]} พ.ศ. ${y + 543}`
}

// Formats a full ISO timestamp (e.g. from a timestamptz column) as a Thai
// Buddhist-era date + time, e.g. "19 กันยายน พ.ศ. 2569 14:05".
export function formatThaiDateTime(iso: string | null | undefined, fallback = '-'): string {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const datePart = formatThaiDate(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, fallback)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${datePart} ${hh}:${mm}`
}
