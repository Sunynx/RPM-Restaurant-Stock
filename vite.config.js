import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RPM Inventory System',
        short_name: 'RPM Stock',
        description: 'Inventory Management for Royal Phuket Marina',
        theme_color: '#1e3a8a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'rpm-logo.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
