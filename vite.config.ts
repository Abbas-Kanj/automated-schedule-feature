/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
  // so the build needs that repo name as its base path. Netlify (and local
  // dev/preview) serve from the root, so this only kicks in when the Pages
  // workflow sets GH_PAGES=true.
  base: process.env.GH_PAGES === 'true' ? '/automated-schedule-feature/' : '/',
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    // react-select pulls its own React instance under vitest's browser mode
    // otherwise, which makes its hooks throw on mount (see
    // `schedule-assign-to-fields.test.tsx`).
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundled up front so a cold cache cannot discover them mid-run.
  // When vitest optimizes a dep partway through a file it reloads the page,
  // and the reload briefly resolves a second React — the same
  // "Invalid hook call" the dedupe above exists to prevent, except it only
  // shows on the *first* run after `node_modules/.vite` is cleared, then
  // disappears. Anything a component test mounts that is not already reached
  // from `src/main.tsx` belongs here.
  optimizeDeps: {
    include: ['@radix-ui/react-switch', '@radix-ui/react-popover'],
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
})
