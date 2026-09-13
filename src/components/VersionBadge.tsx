export default function VersionBadge() {
  return (
    <div className="pointer-events-none fixed bottom-1 right-1 z-40 print:hidden">
      <span className="rounded bg-slate-900/70 px-1.5 py-0.5 font-mono text-[9px] text-white/80">
        {__APP_VERSION__} · {__GIT_HASH__}
      </span>
    </div>
  )
}
