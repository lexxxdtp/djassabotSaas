import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate heavy libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react'],
          // Separate Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Increase chunk size warning limit slightly (but we should still be under)
    chunkSizeWarningLimit: 500,
  },
})
