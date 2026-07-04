<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import DateSidebar from './components/DateSidebar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import Lightbox from './components/Lightbox.vue'
import { groupDatesByYear, groupPhotosByDate, type PhotoItem } from './utils/dateGrouping'
import {
  clearSavedAlbumDirectoryHandle,
  deletePhotoFile,
  getSavedAlbumDirectoryHandle,
  pickAlbumDirectory,
  readAlbumDirectory,
  releasePhotoUrls,
  type AlbumDirectoryResult
} from './utils/fileSystem'
import { isThumbnailMode, type ThumbnailMode } from './types/thumbnail'

const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const storedThumbnailMode = localStorage.getItem(THUMBNAIL_STORAGE_KEY)

const photos = ref<PhotoItem[]>([])
const selectedIds = ref<Set<string>>(new Set())
const currentPreview = ref<PhotoItem | null>(null)
const directoryName = ref('尚未选择相册路径')
const statusMessage = ref('请选择包含无限暖暖截图的文件夹，推荐直接选择 NikkiPhotos_HighQuality 图片文件夹。')
const isLoading = ref(false)
const isDeleting = ref(false)
const thumbnailMode = ref<ThumbnailMode>(isThumbnailMode(storedThumbnailMode) ? storedThumbnailMode : 'default')

const dateGroups = computed(() => groupPhotosByDate(photos.value))
const yearGroups = computed(() => groupDatesByYear(dateGroups.value))
const selectedCount = computed(() => selectedIds.value.size)
const totalCount = computed(() => photos.value.length)
const allSelected = computed(() => totalCount.value > 0 && selectedCount.value === totalCount.value)
const currentPreviewIndex = computed(() => {
  if (!currentPreview.value) return -1
  return photos.value.findIndex((photo) => photo.id === currentPreview.value?.id)
})
const hasPreviousPreview = computed(() => currentPreviewIndex.value > 0)
const hasNextPreview = computed(() => currentPreviewIndex.value >= 0 && currentPreviewIndex.value < photos.value.length - 1)

function successStatus(count: number, prefix = '已读取'): string {
  return count
    ? `${prefix} ${count} 张照片。单击选中，双击查看大图；预览中可点删除按钮或按 Delete 删除，←/→ 翻页，Esc 关闭。`
    : '这个文件夹里没有找到符合命名格式的图片。'
}

function replaceAlbum(result: AlbumDirectoryResult, message: string) {
  releasePhotoUrls(photos.value)
  selectedIds.value = new Set()
  currentPreview.value = null
  photos.value = result.photos
  directoryName.value = result.directoryName
  statusMessage.value = message
}

async function restoreSavedDirectory() {
  const savedHandle = await getSavedAlbumDirectoryHandle()
  if (!savedHandle) return

  directoryName.value = `已记住：${savedHandle.name}`
  isLoading.value = true
  statusMessage.value = '正在恢复上次选择的相册路径...'

  try {
    const result = await readAlbumDirectory(savedHandle, { requestPermission: false })
    replaceAlbum(result, successStatus(result.photos.length, '已恢复'))
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '恢复上次相册路径失败，请重新选择文件夹。'
  } finally {
    isLoading.value = false
  }
}

async function chooseDirectory() {
  isLoading.value = true
  statusMessage.value = '正在读取相册，请稍候...'

  try {
    const savedHandle = await getSavedAlbumDirectoryHandle()
    if (savedHandle && !photos.value.length) {
      try {
        const restored = await readAlbumDirectory(savedHandle, { requestPermission: true })
        replaceAlbum(restored, `${successStatus(restored.photos.length, '已恢复')}已继续使用上次记住的相册文件夹。`)
        return
      } catch {
        statusMessage.value = '上次记住的路径无法恢复，请重新选择相册文件夹。'
      }
    }

    const result = await pickAlbumDirectory()
    replaceAlbum(result, `${successStatus(result.photos.length)}已记住本次选择的相册文件夹。`)
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '读取相册失败，请重试。'
  } finally {
    isLoading.value = false
  }
}

async function clearDirectory() {
  await clearSavedAlbumDirectoryHandle()
  releasePhotoUrls(photos.value)
  photos.value = []
  selectedIds.value = new Set()
  currentPreview.value = null
  directoryName.value = '尚未选择相册路径'
  statusMessage.value = '已清除记住的相册路径。需要继续管理相册时，请重新选择文件夹。'
}

function changeThumbnailMode(mode: ThumbnailMode) {
  thumbnailMode.value = mode
  localStorage.setItem(THUMBNAIL_STORAGE_KEY, mode)
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }

  selectedIds.value = new Set(photos.value.map((photo) => photo.id))
}

function togglePhoto(photoId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(photoId)) {
    next.delete(photoId)
  } else {
    next.add(photoId)
  }
  selectedIds.value = next
}

function toggleDate(dateKey: string) {
  const group = dateGroups.value.find((item) => item.dateKey === dateKey)
  if (!group) return

  const next = new Set(selectedIds.value)
  const isWholeDaySelected = group.photos.every((photo) => next.has(photo.id))

  for (const photo of group.photos) {
    if (isWholeDaySelected) {
      next.delete(photo.id)
    } else {
      next.add(photo.id)
    }
  }

  selectedIds.value = next
}

async function deletePhotos(targets: PhotoItem[], confirmMessage: string, keepPreviewOpen = false) {
  if (!targets.length || isDeleting.value) return
  if (!window.confirm(confirmMessage)) return

  isDeleting.value = true
  const deletedIds = new Set<string>()
  const failedNames: string[] = []
  const previewIndexBeforeDelete = currentPreviewIndex.value

  for (const photo of targets) {
    try {
      await deletePhotoFile(photo)
      deletedIds.add(photo.id)
    } catch {
      failedNames.push(photo.name)
    }
  }

  const remainingPhotos = photos.value.filter((photo) => !deletedIds.has(photo.id))
  const deletedCurrentPreview = currentPreview.value ? deletedIds.has(currentPreview.value.id) : false

  photos.value = remainingPhotos
  selectedIds.value = new Set([...selectedIds.value].filter((id) => !deletedIds.has(id)))

  if (deletedCurrentPreview) {
    currentPreview.value = keepPreviewOpen
      ? remainingPhotos[Math.min(previewIndexBeforeDelete, remainingPhotos.length - 1)] ?? null
      : null
  }

  statusMessage.value = failedNames.length
    ? `已删除 ${deletedIds.size} 张，${failedNames.length} 张删除失败：${failedNames.join('、')}`
    : `已删除 ${deletedIds.size} 张照片。`

  isDeleting.value = false
}

async function deleteSelectedPhotos() {
  const targets = photos.value.filter((photo) => selectedIds.value.has(photo.id))
  await deletePhotos(targets, `确定删除选中的 ${targets.length} 张照片吗？这会同步删除电脑文件夹里的原图。`)
}

async function deleteCurrentPreview() {
  if (!currentPreview.value) return
  await deletePhotos([currentPreview.value], `确定删除当前预览的这张照片吗？这会同步删除电脑文件夹里的原图。`, true)
}

function scrollToDate(dateKey: string) {
  document.getElementById(`date-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openPreview(photo: PhotoItem) {
  currentPreview.value = photo
}

function closePreview() {
  currentPreview.value = null
}

function showPreviousPreview() {
  if (!hasPreviousPreview.value) return
  currentPreview.value = photos.value[currentPreviewIndex.value - 1]
}

function showNextPreview() {
  if (!hasNextPreview.value) return
  currentPreview.value = photos.value[currentPreviewIndex.value + 1]
}

onMounted(() => {
  restoreSavedDirectory()
})

onBeforeUnmount(() => {
  releasePhotoUrls(photos.value)
})
</script>

<template>
  <div class="app-shell">
    <TopBar
      :directory-name="directoryName"
      :total-count="totalCount"
      :selected-count="selectedCount"
      :all-selected="allSelected"
      :is-loading="isLoading"
      :is-deleting="isDeleting"
      :thumbnail-mode="thumbnailMode"
      @choose-directory="chooseDirectory"
      @clear-directory="clearDirectory"
      @toggle-all="toggleAll"
      @delete-selected="deleteSelectedPhotos"
      @change-thumbnail-mode="changeThumbnailMode"
    />

    <main class="album-layout">
      <DateSidebar :year-groups="yearGroups" @jump-to-date="scrollToDate" />

      <section class="album-content" aria-label="图片展示区">
        <div class="status-card">
          <div>
            <p class="eyebrow">Album Status</p>
            <h2>{{ totalCount ? `共 ${totalCount} 张照片` : '等待选择相册路径' }}</h2>
          </div>
          <p>{{ statusMessage }}</p>
        </div>

        <PhotoGrid
          :date-groups="dateGroups"
          :selected-ids="selectedIds"
          :thumbnail-mode="thumbnailMode"
          @toggle-photo="togglePhoto"
          @toggle-date="toggleDate"
          @open-preview="openPreview"
        />
      </section>
    </main>

    <Lightbox
      :photo="currentPreview"
      :has-previous="hasPreviousPreview"
      :has-next="hasNextPreview"
      :is-deleting="isDeleting"
      @close="closePreview"
      @previous="showPreviousPreview"
      @next="showNextPreview"
      @delete-current="deleteCurrentPreview"
    />
  </div>
</template>
