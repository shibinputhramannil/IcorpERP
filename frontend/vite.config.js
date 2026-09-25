import { fileURLToPath } from 'url'
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const compatGridPath = path.resolve(__dirname, 'src/components/common/CompatGrid.jsx')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'compat-grid',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id.endsWith('CompatGrid.jsx')) return null
        if (id === './Grid/index.mjs' || id === './Grid' || id === './Grid/index') {
          if (importer && importer.includes('@mui')) {
            return compatGridPath
          }
        }
        if (id === '@mui/material/Grid') {
          return compatGridPath
        }
        return null
      },
    },
    react(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
