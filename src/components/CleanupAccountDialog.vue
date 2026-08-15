<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { LocaleMessages } from '../i18n'

const props = defineProps<{
  visible: boolean
  accounts: string[]
  rememberedChoice: string | null
  messages: LocaleMessages['cleanup']
}>()

const emit = defineEmits<{
  confirm: [accountIds: string[], remember: boolean, choice: string]
  cancel: []
}>()

const selectedAccount = ref('')
const cleanAllAccounts = ref(false)
const rememberChoice = ref(false)
const selectRef = ref<HTMLSelectElement | null>(null)
const selectId = 'cleanup-account-select'

// 已选择有效账号，或勾选全部账号时可以继续
const canConfirm = computed(() => {
  if (cleanAllAccounts.value) return true
  return props.accounts.includes(selectedAccount.value)
})

/** 处理弹窗键盘操作。参数：键盘事件；按 Escape 时取消。 */
function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  emit('cancel')
}

/** 确认账号选择。参数：无；勾选全部时返回全部账号，否则返回选中的账号 id；同时带出是否记住选择及具体选项。 */
function confirmSelection() {
  if (cleanAllAccounts.value) {
    emit('confirm', [...props.accounts], rememberChoice.value, 'all')
    return
  }
  if (!props.accounts.includes(selectedAccount.value)) return
  emit('confirm', [selectedAccount.value], rememberChoice.value, selectedAccount.value)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      // 有记住的选择时回填：'all' 对应清理全部账号，其余为具体账号 id
      const remembered = props.rememberedChoice
      selectedAccount.value = remembered && remembered !== 'all' && props.accounts.includes(remembered) ? remembered : ''
      cleanAllAccounts.value = remembered === 'all'
      rememberChoice.value = remembered === 'all' || selectedAccount.value !== ''
      nextTick(() => selectRef.value?.focus())
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.accountDialogTitle"
        @click.self="emit('cancel')"
        @keydown="handleDialogKeydown"
      >
        <section class="confirm-dialog-panel is-warning cleanup-account-panel">
          <div class="confirm-dialog-content">
            <h2>{{ messages.accountDialogTitle }}</h2>
            <p>{{ messages.accountDialogMessage }}</p>
          </div>

          <div class="cleanup-account-form">
            <label class="cleanup-account-input-label" :for="selectId">{{ messages.accountInputLabel }}</label>
            <select
              :id="selectId"
              ref="selectRef"
              v-model="selectedAccount"
              :disabled="cleanAllAccounts"
            >
              <option value="" disabled>{{ messages.accountSelectPlaceholder }}</option>
              <option v-for="account in accounts" :key="account" :value="account">{{ account }}</option>
            </select>
            <div class="cleanup-account-options">
              <label class="cleanup-account-all">
                <input v-model="cleanAllAccounts" type="checkbox" />
                <span>{{ messages.allAccounts }}</span>
              </label>
              <label class="cleanup-account-all">
                <input v-model="rememberChoice" type="checkbox" />
                <span>{{ messages.rememberChoice }}</span>
              </label>
            </div>
          </div>

          <div class="confirm-dialog-actions">
            <button class="confirm-dialog-button ghost" type="button" @click="emit('cancel')">
              {{ messages.accountCancel }}
            </button>
            <button class="confirm-dialog-button primary" type="button" :disabled="!canConfirm" @click="confirmSelection">
              {{ messages.accountConfirm }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
