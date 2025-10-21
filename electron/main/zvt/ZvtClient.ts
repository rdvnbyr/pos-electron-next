import { EventEmitter } from 'node:events'
import net from 'node:net'
import tls from 'node:tls'
import { logger } from '../logger'

export type ZvtTlsOptions = {
  enabled: boolean
  ca?: Buffer
  rejectUnauthorized?: boolean
}

export type ZvtTimeoutOptions = {
  connectMs?: number
  idleMs?: number
}

export type ZvtConnectOptions = {
  host: string
  port: number
  tls?: ZvtTlsOptions
  timeouts?: ZvtTimeoutOptions
}

type SocketInstance = net.Socket | tls.TLSSocket

type ZvtClientEvents = {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  rawData: (data: Buffer) => void
  timeout: () => void
}

export declare interface ZvtClient {
  on<U extends keyof ZvtClientEvents>(event: U, listener: ZvtClientEvents[U]): this
  once<U extends keyof ZvtClientEvents>(event: U, listener: ZvtClientEvents[U]): this
  off<U extends keyof ZvtClientEvents>(event: U, listener: ZvtClientEvents[U]): this
  emit<U extends keyof ZvtClientEvents>(event: U, ...args: Parameters<ZvtClientEvents[U]>): boolean
}

export class ZvtClient extends EventEmitter {
  #socket?: SocketInstance

  connect(options: ZvtConnectOptions) {
    this.disconnect()
    const { host, port, tls: tlsOptions, timeouts } = options
    logger.info({ host, port, tlsEnabled: tlsOptions?.enabled }, 'zvt connect requested')

    try {
      const socket = tlsOptions?.enabled
        ? tls.connect({
            host,
            port,
            ca: tlsOptions.ca ? [tlsOptions.ca] : undefined,
            rejectUnauthorized: tlsOptions.rejectUnauthorized ?? true
          })
        : net.createConnection({ host, port })

      if (timeouts?.idleMs) {
        socket.setTimeout(timeouts.idleMs)
      }

      let connectTimeout: NodeJS.Timeout | undefined
      if (timeouts?.connectMs) {
        connectTimeout = setTimeout(() => {
          logger.warn({ timeout: timeouts.connectMs }, 'zvt connect timeout')
          socket.destroy(new Error('Connect timeout'))
        }, timeouts.connectMs)
      }

      socket.once('connect', () => {
        if (connectTimeout) clearTimeout(connectTimeout)
        logger.info('zvt socket connected')
        this.emit('connected')
      })

      socket.on('data', (data: Buffer) => {
        logger.debug({ length: data.length, hex: data.toString('hex') }, 'zvt data received')
        this.emit('rawData', data)
      })

      socket.on('timeout', () => {
        logger.warn('zvt socket timeout')
        this.emit('timeout')
        socket.destroy(new Error('Socket timeout'))
      })

      socket.on('error', (error) => {
        if (connectTimeout) clearTimeout(connectTimeout)
        logger.error({ err: error }, 'zvt socket error')
        this.emit('error', error instanceof Error ? error : new Error(String(error)))
      })

      socket.on('close', () => {
        if (connectTimeout) clearTimeout(connectTimeout)
        logger.info('zvt socket closed')
        this.emit('disconnected')
      })

      this.#socket = socket
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error({ err }, 'zvt connect failed')
      this.emit('error', err)
    }
  }

  disconnect() {
    if (this.#socket) {
      logger.info('zvt disconnect requested')
      this.#socket.destroy()
      this.#socket.removeAllListeners()
      this.#socket = undefined
    }
  }

  send(frame: Buffer) {
    if (!this.#socket) {
      throw new Error('Socket not connected')
    }
    this.#socket.write(frame)
  }
}
