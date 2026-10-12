import type { HomeSchemeMetadata } from '../../src/utils/homeBuild/homeSchemeTypes'

export function createEmptyHomeSchemeMetadata(): HomeSchemeMetadata {
  return { version: null, furnitureCount: null, server: null, lastModifyTime: null, coverImageUrl: null }
}
