import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, onUnmounted, ref, Teleport } from 'vue'
import CloudActionsMenu from '../../src/components/CloudActionsMenu.vue'
import CollectionActions from '../../src/components/CollectionActions.vue'

afterEach(() => vi.unstubAllGlobals())

it('keeps the cloud dialog mounted after selection and closes on Escape or outside click', async () => {
  const unmounted = vi.fn()
  const operation = defineComponent({
    setup() {
      const visible = ref(false)
      onUnmounted(unmounted)
      return () => [
        h('button', { onClick: () => (visible.value = true) }, 'Upload'),
        visible.value
          ? h(Teleport, { to: 'body' }, h('div', { role: 'dialog' }, 'Confirm upload'))
          : null
      ]
    }
  })
  const wrapper = mount(CloudActionsMenu, {
    props: { label: 'Cloud' },
    slots: { default: () => h(operation) },
    global: { stubs: { transition: false } },
    attachTo: document.body
  })
  try {
    const trigger = wrapper.get('.cloud-actions-menu > button')
    expect(wrapper.get('.cloud-actions-options').isVisible()).toBe(false)
    await trigger.trigger('click')
    await wrapper.get('.cloud-actions-options > button').trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(unmounted).not.toHaveBeenCalled()
    await trigger.trigger('click')
    await wrapper.get('.cloud-actions-options > button').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element))
    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  } finally {
    wrapper.unmount()
  }
})

it('keeps mobile cloud actions in the existing single menu and lets Escape reach it', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          CollectionActions,
          { label: 'Actions', persistentSecondary: true },
          {
            secondary: () =>
              h(CloudActionsMenu, { label: 'Cloud' }, { default: () => h('button', 'Upload') })
          }
        )
    })
  )
  try {
    expect(wrapper.find('.cloud-actions-menu > button').exists()).toBe(false)
    await wrapper.get('.collection-action-trigger').trigger('click')
    expect(wrapper.get('.cloud-actions-inline').isVisible()).toBe(true)
    await wrapper.get('.cloud-actions-inline > button').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('.collection-action-trigger').attributes('aria-expanded')).toBe('false')
  } finally {
    wrapper.unmount()
  }
})
