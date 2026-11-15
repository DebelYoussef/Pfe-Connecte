import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  // Tailwind passe par @tailwindcss/vite : on empêche Vite d'aller chercher
  // un postcss.config.* dans les dossiers parents (ex. Téléchargements).
  css: { postcss: {} },
})
