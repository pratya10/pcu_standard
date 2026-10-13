import { Link } from 'react-router-dom'

export default function GuideLink({ section = '' }: { section?: string }) {
  return (
    <Link to={`/guide${section ? `#${section}` : ''}`} target="_blank" rel="noopener noreferrer" className="guide-link">
      คู่มือใช้งาน
    </Link>
  )
}
