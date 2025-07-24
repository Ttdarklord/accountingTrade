import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5001',
        changeOrigin: true,
        secure: mode === 'production'
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          pdf: ['jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      mode === 'production' 
        ? process.env.VITE_API_URL || '' 
        : 'http://localhost:5001'
    )
  }
})) 