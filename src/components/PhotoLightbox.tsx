import { useEffect, useState } from 'react'
import type { TopicPhoto } from '../types'
import { getTopicPhotoUrl } from '../lib/topicPhotos'

// Full-screen photo viewer: tap the image to toggle between fit-to-screen
// and its natural size (scrollable to pan when larger than the viewport),
// tap the backdrop or the × to close.
export default function PhotoLightbox({ photo, onClose }: { photo: TopicPhoto | null; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    setZoomed(false)
  }, [photo])

  // The app pins the page at 1x zoom (maximum-scale=1.0) everywhere else so
  // evaluators don't accidentally pinch-zoom the score form — but that same
  // lock would defeat the point of a photo lightbox, so relax it only while
  // one is open and put it back the moment it closes. Also stop the page
  // underneath from scrolling, or a scroll/swipe meant to pan the image
  // just falls through to the page behind it once there's nothing left to pan.
  useEffect(() => {
    if (!photo) return
    const meta = document.querySelector('meta[name="viewport"]')
    const originalViewport = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', 'width=device-width, initial-scale=1.0')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (originalViewport !== null) meta?.setAttribute('content', originalViewport)
      document.body.style.overflow = prevOverflow
    }
  }, [photo])

  if (!photo) return null

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white"
      >
        ×
      </button>
      <div className={zoomed ? 'h-full w-full overflow-auto' : 'flex h-full w-full items-center justify-center p-4'} onClick={(e) => e.stopPropagation()}>
        <img
          src={getTopicPhotoUrl(photo.file_path)}
          alt={photo.file_name ?? ''}
          onClick={() => setZoomed((z) => !z)}
          className={zoomed ? 'w-auto max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}
        />
      </div>
    </div>
  )
}
