export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/supabase'],
  css: [
    '~/assets/css/main.css',
    'mapbox-gl/dist/mapbox-gl.css',
  ],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
      mapboxAccessToken: process.env.NUXT_PUBLIC_MAPBOX_TOKEN || '',
    },
  },
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/dashboard'],
      exclude: ['/', '/login', '/register', '/confirm'],
    }
  }
})