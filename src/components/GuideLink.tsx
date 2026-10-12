import { Link } from 'react-router-dom'

export default function GuideLink({ section = '' }: { section?: string }) {
  return (
    <Link to={`/guide${section ? `#${section}` : ''}`} target="_blank" rel="noopener noreferrer" className="guide-link">
      วิธีใช้งาน <span className="text-xs font-normal">(เปิดหน้าคู่มือ)</span>
    </Link>
  )
}
