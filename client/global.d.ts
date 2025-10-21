import type { ZvtEvent } from '@pos-app/shared-types/ipc'

declare global {
  interface Window {
    ecr: {
      connectTerminal: (config: {
        host: string
        port: number
        tls?: { enabled: boolean; caCertPem?: string; rejectUnauthorized?: boolean }
        timeouts?: { connectMs?: number; idleMs?: number }
      }) => Promise<{ success: boolean; message?: string }>
      disconnectTerminal: () => Promise<void>
      onZvtEvent: (cb: (event: ZvtEvent) => void) => () => void
    }
  }
}

export {}
