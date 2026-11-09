import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Versão exibida no menu; a fonte é o package.json (ver CHANGELOG.md).
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    // Em dev, /api vai para um PostgREST local (ver README).
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
      // M20: "Sincronizar agora" vai para o worker da Pluggy.
      '/sync': { target: process.env.WORKER_PROXY_TARGET ?? 'http://localhost:8080' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
