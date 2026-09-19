import { defineConfig, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { relative, resolve } from 'node:path'

// Vite's application manifest does not describe the separate worker graph.
// Record actual emitted dependencies so deployment/retry checks can inspect
// every runtime, shared dependency, and finite lazy font chunk without guessing
// hashed file names or parsing generated JavaScript.
function mathjaxWorkerManifest(): Plugin {
  return {
    name: 'stz-mathjax-worker-manifest',
    generateBundle(_options, bundle) {
      const sourceName = (id: string) => normalizePath(relative(import.meta.dirname, id))
      const chunks = Object.values(bundle)
        .filter((entry) => entry.type === 'chunk')
        .map((chunk) => ({
          file: chunk.fileName,
          src: chunk.facadeModuleId ? sourceName(chunk.facadeModuleId) : null,
          isEntry: chunk.isEntry,
          isDynamicEntry: chunk.isDynamicEntry,
          imports: [...chunk.imports].sort(),
          dynamicImports: [...chunk.dynamicImports].sort(),
          sources: Object.keys(chunk.modules).map(sourceName).sort(),
        }))
        .sort((left, right) => left.file.localeCompare(right.file))
      this.emitFile({
        type: 'asset',
        fileName: '.vite/mathjax-worker-manifest.json',
        source: JSON.stringify({ version: 1, chunks }, null, 2) + '\n',
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/stratified-tikz/',
  worker: {
    // Each disposable worker owns its native module map, including dependencies
    // and lazy font imports. Terminating it retires failed module identities.
    format: 'es',
    plugins: () => [mathjaxWorkerManifest()],
  },
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
