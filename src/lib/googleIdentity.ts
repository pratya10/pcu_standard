type GoogleIdentity = NonNullable<Window['google']>['accounts']['id']

let pending: Promise<GoogleIdentity> | undefined

/** Share one SDK request across route remounts; failed requests can be retried. */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (pending) return pending

  pending = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      if (error) {
        script.remove()
        reject(error)
      } else {
        resolve(window.google!.accounts.id)
      }
    }
    const timeout = setTimeout(() => finish(new Error('Google sign-in load timed out')), 30_000)
    script.onload = () => finish(window.google?.accounts?.id ? undefined : new Error('Google sign-in unavailable'))
    script.onerror = () => finish(new Error('Google sign-in failed to load'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}
