// ไอคอนไฟล์สไตล์ Google Drive (หน้ากระดาษพับมุม + แถบสีบอกชนิดไฟล์ด้านล่าง) — ไอคอนที่สร้าง
// เองทั้งหมด ไม่ได้ใช้โลโก้/ทรัพย์สินของ Google โดยตรง เพียงเลียนแบบสไตล์ภาพรวม
type FileKind = 'pdf' | 'doc' | 'xls' | 'ppt' | 'image' | 'generic'

function kindOf(mime: string): FileKind {
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('word') || (mime.includes('document') && !mime.includes('spreadsheet'))) return 'doc'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'xls'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'ppt'
  if (mime.startsWith('image/')) return 'image'
  return 'generic'
}

const STYLE: Record<FileKind, { fill: string; accent: string; label: string }> = {
  pdf: { fill: '#F3F4F6', accent: '#EA4335', label: 'PDF' },
  doc: { fill: '#F3F4F6', accent: '#4285F4', label: 'DOC' },
  xls: { fill: '#F3F4F6', accent: '#34A853', label: 'XLS' },
  ppt: { fill: '#F3F4F6', accent: '#F9AB00', label: 'PPT' },
  image: { fill: '#F3F4F6', accent: '#9334E6', label: 'IMG' },
  generic: { fill: '#F3F4F6', accent: '#9AA0A6', label: 'FILE' },
}

export default function FileTypeIcon({ mime, className = 'h-9 w-9' }: { mime: string; className?: string }) {
  const kind = kindOf(mime)
  const { fill, accent, label } = STYLE[kind]
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <path d="M8 2h14l6 6v24a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill={fill} stroke="#D1D5DB" strokeWidth="1" />
      <path d="M22 2v5a1 1 0 0 0 1 1h5" fill="none" stroke="#D1D5DB" strokeWidth="1" />
      <rect x="6" y="24" width="24" height="9" rx="2" fill={accent} />
      <text x="18" y="30.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </svg>
  )
}
