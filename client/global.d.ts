import type { ZvtEvent } from '@pos-app/shared-types/ipc'

declare global {
  interface Window {
    ecr: {
      connectTerminal: (config: {
        host: string
        port: number
        terminalId?: string
        connectionType: 'tcp' | 'serial'
        currency: 'EUR' | 'USD'
        password?: string
        tls?: { enabled: boolean; caCertPem?: string; rejectUnauthorized?: boolean }
        timeouts?: { connectMs?: number; idleMs?: number }
      }) => Promise<{ success: boolean; message?: string }>
      disconnectTerminal: () => Promise<void>
      startPayment: (payload: { amountCents: number; currency: 'EUR' | 'USD' }) => Promise<{
        success: boolean
        message?: string
        rrn?: string
        authCode?: string
      }>
      onZvtEvent: (cb: (event: ZvtEvent) => void) => () => void
    }
  }
}

export {}
