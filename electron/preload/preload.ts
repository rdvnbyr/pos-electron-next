import { contextBridge, ipcRenderer } from 'electron'
import type { RendererConnectPayload, RendererStartPaymentPayload } from '../main/runtime'
import type { ZvtEvent } from '@pos-app/shared-types/ipc'

contextBridge.exposeInMainWorld('ecr', {
  connectTerminal: async (config: RendererConnectPayload) => {
    const response = await ipcRenderer.invoke('zvt:connect', config)
    return response as { success: boolean; message?: string }
  },
  disconnectTerminal: async () => {
    await ipcRenderer.invoke('zvt:disconnect')
  },
  startPayment: async (payload: RendererStartPaymentPayload) => {
    const response = await ipcRenderer.invoke('zvt:start-payment', payload)
    return response as {
      success: boolean
      message?: string
      rrn?: string
      authCode?: string
    }
  },
  onZvtEvent: (listener: (event: ZvtEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: ZvtEvent) => listener(payload)
    ipcRenderer.on('zvt:event', handler)
    return () => {
      ipcRenderer.removeListener('zvt:event', handler)
    }
  }
})
