import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'util', 'stream', 'crypto', 'events', 'path'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/terra/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: [
      '@terra-money/terra.js',
    ],
  },
})