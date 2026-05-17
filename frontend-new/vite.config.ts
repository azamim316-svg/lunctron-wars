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
    include: [
      '@terra-money/feather.js',
      '@terra-money/terra.proto',
      '@terra-money/terra.proto/terra/smartaccount/v1/tx',
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: {
      '@terra-money/terra.proto/terra/smartaccount/v1/tx': 
        '/node_modules/@terra-money/terra.proto/terra/smartaccount/v1/tx.js',
    },
  },
})