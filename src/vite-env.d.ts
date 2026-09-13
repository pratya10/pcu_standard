/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
declare const __GIT_HASH__: string

interface GoogleIdCredentialResponse {
  credential: string
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string
          callback: (response: GoogleIdCredentialResponse) => void
          auto_select?: boolean
        }): void
        renderButton(
          parent: HTMLElement,
          options: { theme?: string; size?: string; text?: string; shape?: string; width?: number },
        ): void
        prompt(): void
      }
    }
  }
}
