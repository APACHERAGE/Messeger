import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = { '/api': 'http://127.0.0.1:8080' }
export default defineConfig(({ mode }) => {
  const demoPreview = mode === 'demo-preview'
  return {
    plugins: [react()],
    // Keep all .env files, private public/ files and local API routing out of hosted demos.
    envDir: demoPreview ? './web-preview/isolated-env' : undefined,
    publicDir: demoPreview ? false : 'public',
    build: { sourcemap: false },
    server: demoPreview ? {} : { proxy },
    preview: demoPreview ? {} : { proxy },
  }
})
