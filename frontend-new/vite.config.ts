import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'util', 'stream', 'crypto'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  optimizeDeps: {
    include: ['@terra-money/feather.js'],
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})