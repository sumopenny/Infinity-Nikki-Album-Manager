<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Language } from '../i18n/types'
import { wardrobeEvolutionMessages } from '../utils/wardrobe/wardrobePresentation'

const props = withDefaults(defineProps<{ language?: Language; disabled?: boolean }>(), {
  language: 'zh'
})
const enabled = defineModel<boolean>({ required: true })
const hintId = useId()
const t = computed(() => wardrobeEvolutionMessages[props.language])
</script>

<template>
  <label class="wardrobe-mobile-evolution">
    <input
      v-model="enabled"
      type="checkbox"
      role="switch"
      :disabled="disabled"
      :aria-describedby="hintId"
    />
    <span class="wardrobe-mobile-evolution-title">{{ t.label }}</span>
    <span :id="hintId" class="wardrobe-mobile-evolution-hint">{{
      enabled ? t.enabledHint : t.disabledHint
    }}</span>
  </label>
</template>
