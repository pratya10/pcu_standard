import { useState } from 'react'
import { getLogoUrl } from '../lib/branding'

export default function BrandLogo({ className }: { className?: string }) {
  const [url] = useState(() => getLogoUrl())
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return <img src={url} alt="โลโก้หน่วยงาน" className={className} onError={() => setHidden(true)} />
}
