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
