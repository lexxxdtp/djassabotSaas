import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'DjassaBot Business',
        short_name: 'DjassaBot',
        description: 'Votre Vendeur IA Automatisé',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        // App installée : ouvre directement l'espace vendeur (login si déconnecté,
        // dashboard si connecté) — PAS la page marketing "/".
        start_url: '/dashboard',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
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
        },
      },
    },
    // Increase chunk size warning limit slightly (but we should still be under)
    chunkSizeWarningLimit: 500,
  },
})
