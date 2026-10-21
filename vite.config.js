import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', rollupOptions: { input: { main: 'index.html', vitrine: 'vitrine.html', painel: 'painel.html' } } },
})
