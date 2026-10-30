<script setup lang="ts">
import { computed } from 'vue'
import Dialog from './HelpAboutDialog.vue'
import { helpAboutZh, helpAboutEn } from '../i18n/messages/helpAbout'
const props = defineProps<{ language: 'zh' | 'en'; visible: boolean; compact: boolean }>()
const messages = computed(() => props.language === 'zh' ? helpAboutZh : helpAboutEn)
</script>
<template><Dialog :visible="visible" :compact="compact" :messages="messages" /></template>
