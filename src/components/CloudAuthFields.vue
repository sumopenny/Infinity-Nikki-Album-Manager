<script setup lang="ts">
import { computed } from 'vue'
import { resonanceCloudMessages } from '../i18n/messages/resonanceCloud'
const props = defineProps<{ language: 'zh' | 'en'; registering: boolean; busy: boolean }>()
const username = defineModel<string>('username', { required: true })
const password = defineModel<string>('password', { required: true })
const confirmation = defineModel<string>('confirmation', { required: true })
const t = computed(() => resonanceCloudMessages[props.language])
</script>
<template>
  <p>{{ t.credentials }}</p>
  <label
    >{{ t.username
    }}<input
      v-model="username"
      name="username"
      autocomplete="username"
      minlength="4"
      maxlength="32"
      pattern="[A-Za-z0-9_]{4,32}"
      required
      :disabled="busy"
  /></label>
  <label
    >{{ t.password
    }}<input
      v-model="password"
      name="password"
      type="password"
      :autocomplete="registering ? 'new-password' : 'current-password'"
      required
      :disabled="busy"
  /></label>
  <label v-if="registering"
    >{{ t.confirmPassword
    }}<input
      v-model="confirmation"
      name="confirmation"
      type="password"
      autocomplete="new-password"
      required
      :disabled="busy"
  /></label>
</template>
