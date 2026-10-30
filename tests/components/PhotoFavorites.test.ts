import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, expect, it } from 'vitest'
import { usePhotoFavorites } from '../../src/composables/usePhotoFavorites'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); localStorage.clear() })
function page() {
  let state!: ReturnType<typeof usePhotoFavorites>
  wrappers.push(mount(defineComponent({ setup() { state = usePhotoFavorites(() => true); return () => null } })))
  return state
}
it('merges independent stale pages without losing additions or resurrecting removals', () => {
  localStorage.setItem('infinity-nikki-favorite-photo-ids', JSON.stringify(['old']))
  const a = page(), b = page()
  a.value = new Set(['a'])
  b.value = new Set([...b.value, 'b'])
  expect([...page().value].sort()).toEqual(['a', 'b'])
  window.dispatchEvent(new StorageEvent('storage', { key: 'infinity-nikki-favorite-photo-ids:item:a' }))
  expect([...b.value].sort()).toEqual(['a', 'b'])
})
