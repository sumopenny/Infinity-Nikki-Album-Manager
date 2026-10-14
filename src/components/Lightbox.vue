<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Heart,
  Pencil,
  RotateCcw,
  ScanSearch,
  Trash2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'
import type { OutfitMessages } from '../i18n'
import type { PhotoItem } from '../utils/photoGrouping'
import type { OutfitItem } from '../utils/outfit/outfitFileSystem'
import type { HomeSchemeItem } from '../utils/homeBuild/homeSchemeTypes'
import type { HomeSchemeMessages } from '../i18n/messages/homeScheme'
import { loadImageUrlWithSize, loadPhotoWithRetryAndSize } from '../utils/photoLoader'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

type PreviewPhoto = Omit<PhotoItem, 'fileHandle' | 'directoryHandle'>

const MIN_ZOOM = 50
const MAX_ZOOM = 300
const ZOOM_STEP = 25

const props = defineProps<{
  photo: PhotoItem | PreviewPhoto | null
  hasPrevious: boolean
  hasNext: boolean
  isDeleting: boolean
  isFavorite: boolean
  keyboardEnabled: boolean
  mode: 'album' | 'trash' | 'outfit' | 'home'
  outfit?: OutfitItem | null
  outfitMessages?: OutfitMessages
  homeScheme?: HomeSchemeItem | null
  homeMessages?: HomeSchemeMessages
  messages: LocaleMessages['lightbox']
  dateMessages: LocaleMessages['date']
}>()
useBodyScrollLock(computed(() => Boolean(props.photo)))

const emit = defineEmits<{
  close: []
  previous: []
  next: []
  deleteCurrent: []
  toggleFavorite: []
  restoreCurrent: []
  permanentlyDeleteCurrent: []
  copyOutfit: []
  editOutfit: []
  copyHomeScheme: []
  editHomeScheme: []
  editPhotoNote: []
  parsePhoto: []
}>()

const displayedPhoto = ref<PhotoItem | PreviewPhoto | null>(null)
const imageAspectRatio = ref<number | null>(null)
const viewportSize = ref({ width: 0, height: 0 })
const zoom = ref(100)
const pan = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragOrigin = ref({ x: 0, y: 0 })
const navigationButtonsHidden = ref(false)
type TouchPoint = { x: number; y: number }
const touchPoints = new Map<number, TouchPoint>()
let touchStart: (TouchPoint & { time: number }) | null = null
let hadPinch = false
let pinch: {
  distance: number
  center: TouchPoint
  zoom: number
  pan: TouchPoint
  stageCenter: TouchPoint
} | null = null
let previewLoadToken = 0
let previewAbortController: AbortController | null = null

const isPreviewLoading = computed(() =>
  Boolean(props.photo && displayedPhoto.value?.id !== props.photo.id)
)
const imageOrientation = computed(() => {
  if (!imageAspectRatio.value) return 'pending'
  if (imageAspectRatio.value < 0.95) return 'portrait'
  if (imageAspectRatio.value > 1.05) return 'landscape'
  return 'square'
})
const lightboxPanelClass = computed(() => `lightbox-panel--${imageOrientation.value}`)
const imageTransform = computed(() => ({
  transform: `translate3d(${pan.value.x}px, ${pan.value.y}px, 0) scale(${zoom.value / 100})`,
  cursor: zoom.value > 100 ? (dragging.value ? 'grabbing' : 'grab') : 'default'
}))

const lightboxLayout = computed(() => {
  if (!imageAspectRatio.value || !viewportSize.value.width || !viewportSize.value.height)
    return null
  const viewportWidth = viewportSize.value.width
  const viewportHeight = viewportSize.value.height
  const overlayPadding = getClampedValue(12, viewportWidth * 0.04, 32) * 2
  const availableWidth = Math.max(0, viewportWidth - overlayPadding)
  const panelHorizontalChrome = 30
  const panelVerticalChrome = getClampedValue(104, viewportHeight * 0.14, 148)
  const imageMaxHeight = Math.max(160, viewportHeight - overlayPadding - panelVerticalChrome)
  const preferredWidth = imageMaxHeight * imageAspectRatio.value + panelHorizontalChrome
  const minWidth = Math.min(availableWidth, imageOrientation.value === 'portrait' ? 300 : 420)
  const panelWidth = Math.round(Math.min(Math.max(preferredWidth, minWidth), availableWidth, 1500))
  const stageHeight = Math.round(
    Math.min(
      imageMaxHeight,
      Math.max(160, (panelWidth - panelHorizontalChrome) / imageAspectRatio.value)
    )
  )
  return { panelWidth, stageHeight }
})

const lightboxPanelStyle = computed(() =>
  lightboxLayout.value && imageAspectRatio.value
    ? {
        '--lightbox-panel-width': `${lightboxLayout.value.panelWidth}px`,
        '--lightbox-stage-height': `${lightboxLayout.value.stageHeight}px`,
        '--lightbox-image-aspect-ratio': `${imageAspectRatio.value}`
      }
    : undefined
)

/** 把数值限制在指定范围内。参数：min、preferred、max 分别为最小值、目标值和最大值。 */
function getClampedValue(min: number, preferred: number, max: number) {
  return Math.min(Math.max(preferred, min), max)
}

/** 同步当前可视窗口尺寸。参数：无。 */
function updateViewportSize() {
  viewportSize.value = {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight
  }
}

/** 重置缩放与拖动状态。参数：无。 */
function resetTransform() {
  zoom.value = 100
  pan.value = { x: 0, y: 0 }
  dragging.value = false
  touchPoints.clear()
  touchStart = null
  pinch = null
}

/** 更新缩放比例并在回到 100% 时复位位移。参数：nextZoom 为目标百分比。 */
function setZoom(nextZoom: number) {
  zoom.value = getClampedValue(MIN_ZOOM, Math.round(nextZoom), MAX_ZOOM)
  if (zoom.value <= 100) pan.value = { x: 0, y: 0 }
}

/** 使用滚轮按固定步长缩放。参数：event 为滚轮事件。 */
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  setZoom(zoom.value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
}

/** 记录双指中心和距离，使缩放围绕手指位置而不是图片中心跳动。 */
function beginPinch(stage: HTMLElement) {
  const [first, second] = [...touchPoints.values()]
  if (!first || !second) return
  const rect = stage.getBoundingClientRect()
  pinch = {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    zoom: zoom.value,
    pan: { ...pan.value },
    stageCenter: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  hadPinch = true
}

/** 鼠标保留放大后拖动；触屏同时支持单指翻页、双指缩放和放大后平移。 */
function startDrag(event: PointerEvent) {
  if ((event.target as Element).closest('button')) return
  if (event.pointerType === 'touch') {
    if (!touchPoints.size) {
      touchStart = { x: event.clientX, y: event.clientY, time: Date.now() }
      hadPinch = false
    }
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touchPoints.size === 2) beginPinch(event.currentTarget as HTMLElement)
  } else if (zoom.value <= 100) return
  dragging.value = zoom.value > 100
  dragOrigin.value = { x: event.clientX - pan.value.x, y: event.clientY - pan.value.y }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (event.pointerType === 'touch' && touchPoints.has(event.pointerId)) {
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touchPoints.size >= 2 && pinch) {
      const [first, second] = [...touchPoints.values()]
      const center = { x: (first!.x + second!.x) / 2, y: (first!.y + second!.y) / 2 }
      setZoom(
        (pinch.zoom * Math.hypot(second!.x - first!.x, second!.y - first!.y)) / pinch.distance
      )
      const ratio = zoom.value / pinch.zoom
      if (zoom.value > 100)
        pan.value = {
          x:
            center.x -
            pinch.stageCenter.x -
            (pinch.center.x - pinch.stageCenter.x - pinch.pan.x) * ratio,
          y:
            center.y -
            pinch.stageCenter.y -
            (pinch.center.y - pinch.stageCenter.y - pinch.pan.y) * ratio
        }
      return
    }
  }
  if (dragging.value)
    pan.value = { x: event.clientX - dragOrigin.value.x, y: event.clientY - dragOrigin.value.y }
}

function endDrag(event: PointerEvent) {
  touchPoints.delete(event.pointerId)
  pinch = null
  const remaining = [...touchPoints.values()][0]
  if (remaining) {
    if (touchPoints.size >= 2) beginPinch(event.currentTarget as HTMLElement)
    dragging.value = zoom.value > 100
    dragOrigin.value = { x: remaining.x - pan.value.x, y: remaining.y - pan.value.y }
    return
  }
  // 只有没有经历双指缩放的短水平手势可以翻页，取消事件永远不翻页。
  if (
    event.type !== 'pointercancel' &&
    touchStart &&
    !hadPinch &&
    zoom.value <= 100 &&
    Date.now() - touchStart.time < 700
  ) {
    const dx = event.clientX - touchStart.x,
      dy = event.clientY - touchStart.y
    if (Math.abs(dx) >= 60 && Math.abs(dy) < Math.abs(dx) / 2) {
      if (dx < 0 && props.hasNext) emit('next')
      if (dx > 0 && props.hasPrevious) emit('previous')
    }
  }
  touchStart = null
  dragging.value = false
}

function hideNavigationButtons() {
  navigationButtonsHidden.value = true
  ;(document.activeElement as HTMLElement | null)?.blur()
}

function showNavigationButtons() {
  navigationButtonsHidden.value = false
}

/** 优先读取并解码用户主动打开的原图；尺寸直接复用解码结果，不再二次探测。参数：nextPhoto 为待显示照片。 */
async function updateDisplayedPhoto(nextPhoto: PhotoItem | PreviewPhoto): Promise<void> {
  const currentToken = ++previewLoadToken
  previewAbortController?.abort()
  previewAbortController = new AbortController()

  try {
    const { width, height } =
      'fileHandle' in nextPhoto || nextPhoto.loadImageBlob
        ? await loadPhotoWithRetryAndSize(nextPhoto, previewAbortController.signal)
        : await loadImageUrlWithSize(nextPhoto.url ?? '', previewAbortController.signal)
    if (currentToken !== previewLoadToken) return
    if (width && height) imageAspectRatio.value = width / height
    displayedPhoto.value = nextPhoto
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    // 解码失败仍打开预览面板，由失败占位呈现
    if (currentToken === previewLoadToken) displayedPhoto.value = nextPhoto
  }
}

watch(
  () => props.photo,
  (nextPhoto) => {
    updateViewportSize()
    resetTransform()
    navigationButtonsHidden.value = false
    if (!nextPhoto) {
      previewLoadToken += 1
      previewAbortController?.abort()
      previewAbortController = null
      displayedPhoto.value = null
      imageAspectRatio.value = null
      return
    }
    void updateDisplayedPhoto(nextPhoto)
  },
  { immediate: true }
)

/** 处理预览快捷键；确认弹窗等上层弹窗打开时不响应。参数：event 为键盘事件。 */
function handleKeydown(event: KeyboardEvent) {
  if (!props.photo || !props.keyboardEnabled) return
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowLeft' && props.hasPrevious) emit('previous')
  if (event.key === 'ArrowRight' && props.hasNext) emit('next')
  if (
    event.key === 'Delete' &&
    props.mode !== 'outfit' &&
    props.mode !== 'home' &&
    !props.isDeleting &&
    !isPreviewLoading.value
  ) {
    event.preventDefault()
    props.mode === 'trash' ? emit('permanentlyDeleteCurrent') : emit('deleteCurrent')
  }
}

/** 恢复当前回收照片，切图加载期间忽略点击。参数：无。 */
function handleRestoreClick() {
  if (!props.isDeleting && !isPreviewLoading.value) emit('restoreCurrent')
}

/** 删除当前预览照片，切图加载期间忽略点击。参数：无。 */
function handleDeleteClick() {
  if (props.isDeleting || isPreviewLoading.value) return
  if (props.mode === 'home') return
  props.mode === 'trash' ? emit('permanentlyDeleteCurrent') : emit('deleteCurrent')
}

onMounted(() => {
  updateViewportSize()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateViewportSize)
  window.visualViewport?.addEventListener('resize', updateViewportSize)
})

onUnmounted(() => {
  previewAbortController?.abort()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateViewportSize)
  window.visualViewport?.removeEventListener('resize', updateViewportSize)
})
/** 手动翻页时先隐藏手势导航提示，再通知父组件切换照片。 */
function navigatePreview(direction: 'previous' | 'next') {
  hideNavigationButtons()
  if (direction === 'previous') emit('previous')
  else emit('next')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="displayedPhoto"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="lightbox-panel" :class="lightboxPanelClass" :style="lightboxPanelStyle">
          <div class="lightbox-header">
            <div class="lightbox-caption">
              <strong
                >{{ dateMessages.displayDate(displayedPhoto.dateKey) }}
                {{ displayedPhoto.timeText }}</strong
              >
              <span v-if="mode !== 'home'">{{ displayedPhoto.fileSizeText }}</span>
              <span v-if="mode === 'album' && displayedPhoto.note">{{ displayedPhoto.note }}</span>
            </div>
            <button
              class="lightbox-close"
              type="button"
              :title="messages.closeAria"
              :aria-label="messages.closeAria"
              @click="emit('close')"
            >
              <X :size="19" />
            </button>
          </div>

          <div
            class="lightbox-stage"
            @wheel="handleWheel"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="endDrag"
          >
            <img
              :key="displayedPhoto.id"
              :src="displayedPhoto.url ?? undefined"
              :alt="displayedPhoto.name"
              :style="imageTransform"
              draggable="false"
            />
            <div
              class="lightbox-nav-zone lightbox-nav-zone--prev"
              :class="{ 'is-navigation-hidden': navigationButtonsHidden }"
              @pointerleave="showNavigationButtons"
            >
              <button
                v-if="hasPrevious"
                class="lightbox-nav-button"
                type="button"
                :title="messages.previousAria"
                :aria-label="messages.previousAria"
                @click="navigatePreview('previous')"
              >
                <ChevronLeft :size="22" />
              </button>
            </div>
            <div
              class="lightbox-nav-zone lightbox-nav-zone--next"
              :class="{ 'is-navigation-hidden': navigationButtonsHidden }"
              @pointerleave="showNavigationButtons"
            >
              <button
                v-if="hasNext"
                class="lightbox-nav-button"
                type="button"
                :title="messages.nextAria"
                :aria-label="messages.nextAria"
                @click="navigatePreview('next')"
              >
                <ChevronRight :size="22" />
              </button>
            </div>
          </div>
        </div>
        <div class="lightbox-footer">
          <div class="lightbox-toolbar">
            <div v-if="mode === 'outfit' && outfit && outfitMessages" class="lightbox-outfit-meta">
              <span
                ><strong>{{ outfitMessages.tagsTitle }}：</strong
                >{{ outfit.tags[0] || outfitMessages.uncategorized }}</span
              >
              <span
                ><strong>{{ outfitMessages.codeLabel }}：</strong
                >{{ outfit.code || outfitMessages.pending }}</span
              >
              <span v-if="outfit.note"
                ><strong>{{ outfitMessages.noteLabel }}：</strong>{{ outfit.note }}</span
              >
            </div>
            <div
              v-else-if="mode === 'home' && homeScheme && homeMessages"
              class="lightbox-outfit-meta"
            >
              <span
                ><strong>{{ homeMessages.tagsTitle }}：</strong
                >{{ homeScheme.tags[0] || homeMessages.uncategorized }}</span
              >
              <span
                ><strong>{{ homeMessages.code }}：</strong>{{ homeScheme.code }}</span
              >
              <span v-if="homeScheme.note"
                ><strong>{{ homeMessages.note }}：</strong>{{ homeScheme.note }}</span
              >
            </div>
            <div
              v-if="mode === 'outfit' || mode === 'home'"
              class="lightbox-toolbar-divider"
              aria-hidden="true"
            ></div>
            <div class="lightbox-zoom-controls">
              <button
                type="button"
                :title="messages.zoomOut"
                :aria-label="messages.zoomOut"
                :disabled="zoom <= MIN_ZOOM"
                @click="setZoom(zoom - ZOOM_STEP)"
              >
                <ZoomOut :size="17" />
              </button>
              <button
                type="button"
                :title="messages.resetZoom"
                :aria-label="messages.resetZoom"
                @click="resetTransform"
                >{{ zoom }}%</button
              >
              <button
                type="button"
                :title="messages.zoomIn"
                :aria-label="messages.zoomIn"
                :disabled="zoom >= MAX_ZOOM"
                @click="setZoom(zoom + ZOOM_STEP)"
              >
                <ZoomIn :size="17" />
              </button>
            </div>
            <template v-if="mode === 'outfit' && outfitMessages">
              <button
                type="button"
                :title="outfitMessages.copy"
                :aria-label="outfitMessages.copy"
                :disabled="!outfit?.code"
                @click="emit('copyOutfit')"
              >
                <Copy :size="18" />
              </button>
              <button
                type="button"
                :title="outfitMessages.edit"
                :aria-label="outfitMessages.edit"
                @click="emit('editOutfit')"
              >
                <Edit3 :size="18" />
              </button>
            </template>
            <template v-else-if="mode === 'home' && homeScheme && homeMessages">
              <button
                type="button"
                :title="homeMessages.copy"
                :aria-label="homeMessages.copy"
                @click="emit('copyHomeScheme')"
                ><Copy :size="18"
              /></button>
              <button
                type="button"
                :title="homeMessages.edit"
                :aria-label="homeMessages.edit"
                @click="emit('editHomeScheme')"
                ><Edit3 :size="18"
              /></button>
            </template>
            <button
              v-if="mode === 'album'"
              type="button"
              :title="messages.parsePhoto"
              :aria-label="messages.parsePhoto"
              @click="emit('parsePhoto')"
              ><ScanSearch :size="18"
            /></button>
            <button
              v-if="mode === 'album'"
              type="button"
              :title="messages.editNote"
              :aria-label="messages.editNote"
              @click="emit('editPhotoNote')"
              ><Pencil :size="18"
            /></button>
            <button
              v-if="mode === 'album'"
              type="button"
              :class="{ active: isFavorite }"
              :title="isFavorite ? messages.removeFavorite : messages.favorite"
              :aria-label="isFavorite ? messages.removeFavorite : messages.favorite"
              @click="emit('toggleFavorite')"
            >
              <Heart :size="18" :fill="isFavorite ? 'currentColor' : 'none'" />
            </button>
            <button
              v-else-if="mode === 'trash'"
              type="button"
              :class="{ 'is-preview-loading': isPreviewLoading }"
              :disabled="isDeleting"
              :aria-disabled="isPreviewLoading || undefined"
              :title="messages.restoreCurrent"
              @click="handleRestoreClick"
            >
              <RotateCcw :size="18" />
            </button>
            <button
              v-if="mode === 'album' || mode === 'trash'"
              class="lightbox-delete"
              type="button"
              :class="{ 'is-preview-loading': isPreviewLoading }"
              :disabled="isDeleting"
              :aria-disabled="isPreviewLoading || undefined"
              :title="mode === 'trash' ? messages.permanentlyDeleteCurrent : messages.deleteCurrent"
              @click="handleDeleteClick"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
