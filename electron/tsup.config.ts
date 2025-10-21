import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      'main/index': 'main/main.ts'
    },
    format: ['esm'],
    target: 'node18',
    splitting: false,
    clean: true,
    sourcemap: true,
    outDir: 'dist',
    platform: 'node',
    external: ['electron', 'path'],
    outExtension: () => ({ js: '.mjs' })
  },
  {
    entry: {
      'preload/preload': 'preload/preload.ts'
    },
    format: ['esm'],
    target: 'node18',
    splitting: false,
    sourcemap: true,
    outDir: 'dist',
    platform: 'node',
    external: ['electron'],
    outExtension: () => ({ js: '.mjs' })
  }
])
