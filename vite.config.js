import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'assets/*', dest: 'assets' },
        { src: 'pages/*', dest: 'pages' },
        { src: 'components/*', dest: 'components' }
      ]
    })
  ],
  base: '/', // important for correct paths
})