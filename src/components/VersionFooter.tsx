function formatBuildDate(iso: string) {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`
}

export default function VersionFooter() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-xs text-slate-400">
        Version {__APP_VERSION__} | {formatBuildDate(__BUILD_DATE__)} ( {__GIT_HASH__} )
      </p>
      <div className="h-px w-full max-w-xs bg-slate-200" />
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400">
        <span>Powered by</span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
            <path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z" />
            <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3A10 10 0 0 0 3 16.6L6.4 14Z" />
            <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6Z" />
          </svg>
          Google
        </span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2.4a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.1-4.7-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.5 9.5 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.8-4.7 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.4Z"
            />
          </svg>
          GitHub
        </span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M16.9 17.5H5.2a3.2 3.2 0 0 1-.3-6.4 5.4 5.4 0 0 1 10.2-1.5 4 4 0 0 1 1.8 7.9Z" />
            <path d="M18.8 12.4a3.7 3.7 0 0 0-1.2.2 4.7 4.7 0 0 0-8.8 1.7h10.8a1.6 1.6 0 0 1 0 3.2h-.8a2.6 2.6 0 0 0 0-5.1Z" />
          </svg>
          Cloudflare
        </span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M13.3 2.7 4.9 13.2h7.6l-1.8 8.1 8.4-10.5h-7.6l1.8-8.1Z" />
          </svg>
          Supabase
        </span>
      </div>
    </div>
  )
}
