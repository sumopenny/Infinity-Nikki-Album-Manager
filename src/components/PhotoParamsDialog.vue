<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalFocus } from '../composables/useModalFocus'
import { Bookmark, Copy, ScanSearch, X } from 'lucide-vue-next'
import type { PhotoItem } from '../utils/photoGrouping'
import type { PhotoParamsProgress, PhotoParamsResult } from '../utils/photo-params/types'
import type { PhotoParamsMessages } from '../i18n/messages/photoParams'

const props = defineProps<{
  visible: boolean
  saved?: boolean
  favoriteLabel?: string
  photo: PhotoItem | { name: string } | null
  progress: PhotoParamsProgress
  result: PhotoParamsResult | null
  error: string | null
  uidRequired: boolean
  messages: PhotoParamsMessages
}>()

const emit = defineEmits<{ close: []; copy: []; favorite: []; submitUid: [uid: string] }>()
const panel = ref<HTMLElement | null>(null)
// 参数窗口可从照片卡片独立打开，需自行管理滚动锁和焦点生命周期。
useBodyScrollLock(toRef(props, 'visible'))
useModalFocus(toRef(props, 'visible'), panel, () => emit('close'))
const uidInput = ref('')
const failedImages = ref<Set<string>>(new Set())
watch(
  () => props.visible,
  (visible) => {
    if (!visible) uidInput.value = ''
    failedImages.value = new Set()
  }
)
function resourceKey(title: string, name: string) {
  return `${title}:${name}`
}
function markImageFailed(title: string, name: string) {
  failedImages.value = new Set(failedImages.value).add(resourceKey(title, name))
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dialog-overlay fortune-time-dialog photo-params-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="messages.title"
    >
      <section
        ref="panel"
        tabindex="-1"
        class="dialog-panel fortune-time-panel photo-params-dialog"
      >
        <header class="fortune-time-header photo-params-header">
          <div class="photo-params-header-content">
            <div class="photo-params-title-row">
              <h2>{{ messages.title }}</h2>
              <p v-if="photo" class="photo-params-file-name">{{ photo.name }}</p>
            </div>
          </div>
          <button
            v-if="result?.rawCameraParams && favoriteLabel"
            type="button"
            class="photo-params-favorite-button"
            :disabled="saved"
            @click="emit('favorite')"
            ><Bookmark :size="16" />{{ favoriteLabel }}</button
          >
          <button
            type="button"
            :aria-label="messages.close"
            :title="messages.close"
            @click="emit('close')"
            ><X :size="19" aria-hidden="true"
          /></button>
        </header>

        <div
          class="fortune-time-body photo-params-body"
          :class="{ 'is-loading': progress.stage !== 'ready' && !error }"
        >
          <div
            v-if="progress.stage !== 'ready' && !error"
            class="photo-params-loading"
            role="status"
            aria-live="polite"
          >
            <span class="photo-params-spinner" aria-hidden="true"></span>
            <p>{{ progress.message }}</p>
          </div>

          <div v-if="error" class="photo-params-error">
            <p>{{ error }}</p>
            <!-- uid 表单收进报错模块内部，跟随整体垂直居中，避免与报错区堆叠导致窗口出现滚动条。 -->
            <form
              v-if="!result && uidRequired"
              class="photo-params-uid-form"
              @submit.prevent="uidInput.trim() && emit('submitUid', uidInput.trim())"
            >
              <label for="photo-params-uid-input">{{ messages.uidPrompt }}</label>
              <div>
                <input
                  id="photo-params-uid-input"
                  v-model="uidInput"
                  :placeholder="messages.uidPlaceholder"
                  autocomplete="off"
                />
                <button
                  type="submit"
                  class="confirm-dialog-button primary"
                  :disabled="!uidInput.trim()"
                  ><ScanSearch :size="15" />{{ messages.uidParse }}</button
                >
              </div>
            </form>
          </div>

          <div v-if="result" class="photo-params-content">
            <section v-if="result.environmentFields.length" class="photo-params-section">
              <h3>{{ messages.capture }}</h3>
              <div class="photo-params-grid">
                <div
                  v-for="item in result.environmentFields"
                  :key="item.label"
                  class="photo-params-value photo-params-value--static"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </section>
            <section class="photo-params-section">
              <h3>{{ messages.camera }}</h3>
              <div class="photo-params-grid">
                <div
                  v-for="item in result.cameraFields"
                  :key="item.label"
                  class="photo-params-value"
                >
                  <span>{{ item.label }}</span>
                  <span
                    class="photo-params-slider"
                    :style="{ '--photo-params-slider-ratio': (item.position ?? 50) / 100 }"
                    aria-hidden="true"
                    ><i></i
                  ></span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </section>
            <section class="photo-params-section">
              <h3>{{ messages.image }}</h3>
              <div class="photo-params-grid">
                <div
                  v-for="item in result.imageFields"
                  :key="item.label"
                  class="photo-params-value"
                >
                  <span>{{ item.label }}</span>
                  <span
                    class="photo-params-slider"
                    :style="{ '--photo-params-slider-ratio': (item.position ?? 50) / 100 }"
                    aria-hidden="true"
                    ><i></i
                  ></span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </section>
            <div class="photo-params-resource-grid">
              <section
                v-for="group in result.resourceGroups"
                :key="group.title"
                class="photo-params-section"
              >
                <h3>{{ group.title }}</h3>
                <div
                  class="photo-params-resource-row"
                  :class="{ 'photo-params-resource-row--pose': group.kind === 'pose' }"
                >
                  <img
                    v-if="group.imageUrl && !failedImages.has(resourceKey(group.title, group.name))"
                    :src="group.imageUrl"
                    :alt="group.name"
                    @error="markImageFailed(group.title, group.name)"
                  />
                  <span v-else class="photo-params-resource-image-placeholder" aria-hidden="true"
                    ><ScanSearch :size="19"
                  /></span>
                  <span class="photo-params-resource-placeholder">{{ group.name }}</span>
                  <strong v-if="group.value">{{ group.value }}</strong>
                </div>
              </section>
            </div>
            <section v-if="result.rawCameraParams" class="photo-params-section photo-params-raw">
              <h3>{{ messages.raw }}</h3>
              <code>{{ result.rawCameraParams }}</code>
              <button type="button" class="confirm-dialog-button ghost" @click="emit('copy')"
                ><Copy :size="15" />{{ messages.copy }}</button
              >
            </section>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
/* 2026-10-11：仅动作图片使用项目内银色卡片背景，加载失败时保留默认占位背景。 */
.photo-params-resource-row--pose img {
  background: var(--surface-soft) url('../../img/silverCardBg.png') center / cover no-repeat;
}
.photo-params-header-content {
  flex: 1;
  min-width: 0;
}
.photo-params-header {
  gap: 12px;
}
.photo-params-header .photo-params-favorite-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  width: auto;
  height: auto;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--pink-deep);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.photo-params-header .photo-params-favorite-button:disabled {
  opacity: 0.65;
  cursor: default;
}
@media (max-width: 520px) {
  .photo-params-header {
    flex-wrap: wrap;
  }
  .photo-params-header-content {
    flex: 1 1 170px;
  }
}
</style>
