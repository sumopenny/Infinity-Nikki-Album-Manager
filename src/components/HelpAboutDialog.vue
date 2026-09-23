<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { BookOpen, Info, Keyboard, MousePointer2, ShieldCheck, X } from 'lucide-vue-next'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import type { LocaleMessages } from '../i18n'

const props = defineProps<{ visible: boolean; messages: LocaleMessages['helpAbout'] }>()
const emit = defineEmits<{ close: [] }>()
const panelRef = ref<HTMLElement | null>(null)
const featureIcons = { images: Info, outfit: BookOpen, camera: ShieldCheck, cleanup: ShieldCheck, search: Keyboard, tools: BookOpen }
let previousActiveElement: HTMLElement | null = null
useBodyScrollLock(computed(() => props.visible))

function closeDialog() { emit('close') }
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { closeDialog(); return }
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
  if (!focusable.length) return
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.visible, (visible) => {
  if (visible) { previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null; void nextTick(() => panelRef.value?.querySelector<HTMLElement>('button')?.focus()) }
  else { previousActiveElement?.focus(); previousActiveElement = null }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="visible" class="dialog-overlay help-about-dialog" role="dialog" aria-modal="true" :aria-label="messages.title" @click.self="closeDialog" @keydown="handleKeydown">
        <section ref="panelRef" class="dialog-panel help-about-panel">
          <header class="help-about-header">
            <div><p class="help-about-eyebrow">{{ messages.eyebrow }}</p><h2>{{ messages.title }}</h2></div>
            <button type="button" :title="messages.closeAria" :aria-label="messages.closeAria" @click="closeDialog"><X :size="19" aria-hidden="true" /></button>
          </header>
          <div class="help-about-body">
            <section class="help-about-intro"><h3>{{ messages.introTitle }}</h3><p>{{ messages.intro }}</p><p class="help-about-privacy"><ShieldCheck :size="18" aria-hidden="true" />{{ messages.privacyNote }}</p></section>
            <section><h3>{{ messages.featuresTitle }}</h3><div class="help-about-feature-grid"><article v-for="feature in messages.features" :key="feature.title" class="help-about-feature"><span><component :is="featureIcons[feature.icon as keyof typeof featureIcons] ?? Info" :size="18" aria-hidden="true" /></span><div><h4>{{ feature.title }}</h4><p>{{ feature.text }}</p></div></article></div></section>
            <section><h3><BookOpen :size="17" aria-hidden="true" />{{ messages.tutorialTitle }}</h3><div class="help-about-tutorial-grid"><article v-for="section in messages.tutorialSections" :key="section.title"><h4>{{ section.title }}</h4><ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul></article></div></section>
            <section><h3><ShieldCheck :size="17" aria-hidden="true" />{{ messages.notesTitle }}</h3><ul class="help-about-notes"><li v-for="item in messages.notes" :key="item">{{ item }}</li></ul></section>
            <div class="help-about-shortcuts"><section><h3><MousePointer2 :size="17" aria-hidden="true" />{{ messages.mouseTitle }}</h3><ul><li v-for="item in messages.mouseItems" :key="item">{{ item }}</li></ul></section><section><h3><Keyboard :size="17" aria-hidden="true" />{{ messages.keyboardTitle }}</h3><ul><li v-for="item in messages.keyboardItems" :key="item">{{ item }}</li></ul></section></div>
          </div>
          <footer class="help-about-footer"><button class="primary-button" type="button" @click="closeDialog">{{ messages.confirm }}</button></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
