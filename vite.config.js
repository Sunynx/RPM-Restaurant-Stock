import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import fs from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'generate-version',
      buildStart() {
        if (!fs.existsSync('public')) {
          fs.mkdirSync('public');
        }
        fs.writeFileSync('public/version.json', JSON.stringify({ version: Date.now() }));
      }
    },
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
