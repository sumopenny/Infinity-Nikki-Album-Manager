<script setup lang="ts">
import DesktopMenuTransition from './DesktopMenuTransition.vue'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { PEARPAL_REGIONS, type PearpalRegion } from '../utils/resonance/pearpalRegions'
import type { Language } from '../i18n/types'

const props = defineProps<{ language: Language; disabled?: boolean }>()
const model = defineModel<PearpalRegion>({ required: true })
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const id = useId()
const keys = Object.keys(PEARPAL_REGIONS) as PearpalRegion[]
const label = () => (props.language === 'zh' ? '服务器' : 'Server')

function choose(value: PearpalRegion) {
  model.value = value
  open.value = false
  trigger.value?.focus()
}
async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    await nextTick()
    menu.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }
}
/** 菜单留在弹窗内；Esc 只收起菜单，方向键在选项之间移动。 */
async function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    trigger.value?.focus()
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    if (!open.value) {
      await toggle()
      return
    }
    const buttons = [...(menu.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
}
function outside(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  }
)
onMounted(() => document.addEventListener('click', outside))
onBeforeUnmount(() => document.removeEventListener('click', outside))
</script>

<template>
  <div ref="root" class="data-import-region" @keydown="keydown">
    <span :id="`${id}-label`">{{ label() }}</span>
    <div class="cleanup-account-select-wrap">
      <button
        ref="trigger"
        type="button"
        class="cleanup-account-select"
        :class="{ open }"
        :disabled="disabled"
        :aria-label="label()"
        aria-haspopup="menu"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        @click="toggle"
      >
        <span>{{ PEARPAL_REGIONS[model].name[language] }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
      <DesktopMenuTransition>
        <div
          v-if="open"
          :id="`${id}-menu`"
          ref="menu"
          class="cleanup-account-menu"
          role="menu"
          :aria-labelledby="`${id}-label`"
        >
          <button
            v-for="key in keys"
            :key="key"
            type="button"
            role="menuitemradio"
            :data-region="key"
            :aria-checked="model === key"
            :class="{ active: model === key }"
            @click="choose(key)"
            >{{ PEARPAL_REGIONS[key].name[language] }}</button
          >
        </div>
      </DesktopMenuTransition>
    </div>
  </div>
</template>

<style scoped>
.data-import-region {
  margin: 12px 0;
}
.cleanup-account-select > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
