import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'logos/v1-favicon.svg',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'icons/favicon-16.png',
      ],
      manifest: {
        name: 'chiropract.co — CRM',
        short_name: 'chiropract.co',
        description: 'CRM y panel del paciente — Dr. Miguel Ángel Díaz',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/#crm',
        lang: 'es-CO',
        categories: ['health', 'medical', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Citas de hoy',
            short_name: 'Citas',
            url: '/#crm',
            description: 'Ver citas de hoy',
          },
          {
            name: 'Panel paciente',
            short_name: 'Paciente',
            url: '/#paciente',
            description: 'Acceso del paciente',
          },
        ],
      },
      workbox: {
        // Cap de 4MB por archivo cacheado para evitar abultar (chunk principal ~800KB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Estrategias de cache por origen
        runtimeCaching: [
          {
            // Imágenes hosteadas en el mismo dominio (logos, fotos del Dr.)
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'chiro-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 días
            },
          },
          {
            // Supabase REST/RPC: Network first, fallback a cache (ofrece HC offline si carga antes)
            urlPattern: /^https:\/\/onwgfixvbyknotnbrkgr\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'chiro-supabase-rest',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }, // 1 día
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Edge Functions: Network only (no cachear acciones — solo lecturas idempotentes via REST)
            urlPattern: /^https:\/\/onwgfixvbyknotnbrkgr\.supabase\.co\/functions\/v1\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Storage signed URLs (archivos clínicos / fotos)
            urlPattern: /^https:\/\/onwgfixvbyknotnbrkgr\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chiro-storage',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1 hora (signed URLs vencen)
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Auth endpoints: nunca cachear
            urlPattern: /\/auth\/.*/,
            handler: 'NetworkOnly',
          },
        ],
        // Skip waiting al detectar nueva versión + claim clients
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/functions/, /^\/auth/, /^\/storage/],
      },
      devOptions: {
        // Permite testear el SW en dev con `npm run dev`
        enabled: false,
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
})
