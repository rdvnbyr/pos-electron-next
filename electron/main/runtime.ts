import { BrowserWindow, ipcMain } from 'electron'
import type { ZvtEvent } from '@pos-app/shared-types/ipc'
import { logger } from './logger'
import { ZvtClient, type ZvtConnectOptions } from './zvt/ZvtClient'

export type RendererConnectPayload = {
  host: string
  port: number
  tls?: {
    enabled: boolean
    caCertPem?: string
    rejectUnauthorized?: boolean
  }
  timeouts?: {
    connectMs?: number
    idleMs?: number
  }
}

export class TerminalRuntime {
  #window: BrowserWindow
  #client: ZvtClient

  constructor(window: BrowserWindow) {
    this.#window = window
    this.#client = new ZvtClient()
    this.#wireClientEvents()
    this.#registerIpcHandlers()
  }

  destroy() {
    ipcMain.removeHandler('zvt:connect')
    ipcMain.removeHandler('zvt:disconnect')
    this.#client.disconnect()
  }

  async connect(payload: RendererConnectPayload) {
    const options: ZvtConnectOptions = {
      host: payload.host,
      port: payload.port,
      tls: payload.tls?.enabled
        ? {
            enabled: true,
            ca: payload.tls.caCertPem ? Buffer.from(payload.tls.caCertPem) : undefined,
            rejectUnauthorized: payload.tls.rejectUnauthorized
          }
        : { enabled: false },
      timeouts: payload.timeouts
    }
    this.#client.connect(options)
  }

  disconnect() {
    this.#client.disconnect()
  }

  #registerIpcHandlers() {
    ipcMain.handle('zvt:connect', async (_event, payload: RendererConnectPayload) => {
      try {
        await this.connect(payload)
        return { success: true } as const
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error({ err: error }, 'connect failed')
        return { success: false, message } as const
      }
    })

    ipcMain.handle('zvt:disconnect', async () => {
      this.disconnect()
      return { success: true } as const
    })
  }

  #wireClientEvents() {
    this.#client.on('connected', () => {
      this.#emit({ type: 'connected' })
    })

    this.#client.on('disconnected', () => {
      this.#emit({ type: 'disconnected' })
    })

    this.#client.on('timeout', () => {
      this.#emit({ type: 'error', message: 'Idle timeout' })
    })

    this.#client.on('error', (error) => {
      this.#emit({ type: 'error', message: error.message })
    })

    this.#client.on('rawData', (data) => {
      this.#emit({
        type: 'status',
        code: 'RAW',
        text: data.toString('hex')
      })
    })
  }

  #emit(event: ZvtEvent) {
    logger.debug({ event }, 'emit zvt event')
    if (!this.#window || this.#window.isDestroyed()) {
      return
    }
    this.#window.webContents.send('zvt:event', event)
  }
}
