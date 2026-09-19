import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/stratified-tikz/',
  build: {
    manifest: true,
    rollupOptions: {
      // Build the inactive Phase 31B adapter and its local font asset graph.
      // The editor entry does not import or initialize it until Phase 31C.
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        labelAdapter: resolve(import.meta.dirname, 'src/rendering/labels/labelService.ts'),
      },
      preserveEntrySignatures: 'strict',
    },
  },
})
