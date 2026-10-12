import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/components/**', 'jsdom'],
      ['tests/App.test.ts', 'jsdom'],
      ['tests/likeCounter.test.ts', 'jsdom'],
      ['tests/utils/bodyScrollLock.test.ts', 'jsdom'],
      ['tests/utils/fileSystem.test.ts', 'jsdom'],
      ['tests/utils/outfitCodeParser.test.ts', 'jsdom'],
      ['tests/utils/outfitImage.test.ts', 'jsdom'],
      ['tests/utils/statusNotice.test.ts', 'jsdom']
    ],
    include: ['tests/**/*.test.ts']
  }
})
