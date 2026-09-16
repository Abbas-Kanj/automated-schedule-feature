/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, so only use that base
  // when the Pages workflow sets GH_PAGES=true; Netlify/local serve from root.
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
    // Without this, react-select pulls its own React instance under vitest's
    // browser mode and its hooks throw on mount.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundled so a cold `node_modules/.vite` cache can't discover a dep
  // mid-run — that triggers a page reload that briefly resolves a second
  // React ("Invalid hook call"). Add anything a component test mounts that
  // `src/main.tsx` doesn't already reach.
  optimizeDeps: {
    include: [
      '@radix-ui/react-switch',
      '@radix-ui/react-popover',
      '@radix-ui/react-dialog',
      'react-day-picker',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-tabs',
      'radix-ui',
    ],
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
