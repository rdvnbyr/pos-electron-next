import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './logger'
import { TerminalRuntime } from './runtime'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let runtime: TerminalRuntime | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#060606',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('closed', () => {
    runtime?.destroy()
    runtime = null
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  const rendererUrl =
    process.env.RENDERER_URL ?? `file://${path.join(__dirname, '../../client/.next/server/app/page.html')}`
  await mainWindow.loadURL(rendererUrl)
  runtime = new TerminalRuntime(mainWindow)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await createWindow()
  } catch (error) {
    logger.error({ err: error }, 'failed to create window')
    app.exit(1)
  }
})
