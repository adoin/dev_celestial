import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/dev_celestial/',
  build: {
    outDir: 'dist'
  }
})