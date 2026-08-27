<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BookHeart,
  Bug,
  ChevronDown,
  Eraser,
  FolderOpen,
  Github,
  Grid2X2,
  Heart,
  Info,
  Languages,
  Music2,
  Moon,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  X
} from 'lucide-vue-next'
import FortuneTimeDialog from './FortuneTimeDialog.vue'
// 收款码图片，通过 Vite 打包以保证构建后路径正确
import wxQrCode from '../../img/wx.jpg'
import zfbQrCode from '../../img/zfb.jpg'
import type { Language, LocaleMessages } from '../i18n'
import type { ThumbnailMode } from '../types/thumbnail'
import type { ThemeMode } from '../types/theme'

type OpenMenu = 'album' | 'view' | 'more' | null

const props = defineProps<{
  directoryName: string
  isLoading: boolean
  isRefreshing: boolean
  isDeleting: boolean
  hasAlbumDirectory: boolean
  thumbnailMode: ThumbnailMode
  thumbnailModeOptions: Array<{ value: ThumbnailMode; label: string }>
  themeMode: ThemeMode
  language: Language
  messages: LocaleMessages['topBar']
  fortuneMessages: LocaleMessages['fortuneTime']
  searchQuery?: string
}>()

const emit = defineEmits<{
  chooseDirectory: []
  clearDirectory: []
  refreshAlbum: []
  authorizeX6Game: []
  openCleanup: []
  clearCache: []
  clearData: []
  toggleLanguage: []
  toggleTheme: []
  changeThumbnailMode: [mode: ThumbnailMode]
  openAbout: []
  updateSearch: [value: string]
}>()

// 问题反馈问卷地址：发布问卷星/腾讯问卷后，把链接替换到这里即可
const FEEDBACK_URL = 'https://v.wjx.cn/vm/tUM7gga.aspx'

const openMenu = ref<OpenMenu>(null)
const showDonate = ref(false)
const showFeedback = ref(false)
const showFortuneTime = ref(false)
// iframe 懒加载：首次打开弹窗时才设置 src，避免启动时请求第三方页面
const feedbackLoaded = ref(false)
const feedbackLoadFailed = ref(false)
const headerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const menuTrigger = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: 0, left: 0 })
const isBusy = computed(() => props.isLoading || props.isDeleting)

/** 切换顶部菜单，并保证同一时间只展开一个菜单。参数：menu 为目标菜单。 */
async function toggleMenu(menu: Exclude<OpenMenu, null>, event: MouseEvent) {
  if (openMenu.value === menu) {
    closeMenus()
    return
  }

  menuTrigger.value = event.currentTarget as HTMLElement
  openMenu.value = menu
  await nextTick()
  await alignOpenMenu()
}

/** 让菜单优先在触发项下方居中，并在临近屏幕边缘时保持完整可见。参数：无。 */
async function alignOpenMenu() {
  const dropdown = dropdownRef.value
  const trigger = menuTrigger.value
  if (!dropdown || !trigger) return

  const triggerRect = trigger.getBoundingClientRect()
  menuPosition.value = { top: triggerRect.bottom + 7, left: triggerRect.left + triggerRect.width / 2 }
  await nextTick()
  dropdown.style.setProperty('--menu-shift', '0px')
  const rect = dropdown.getBoundingClientRect()
  const safeInset = 12
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const shift = rect.left < safeInset
    ? safeInset - rect.left
    : rect.right > viewportWidth - safeInset
      ? viewportWidth - safeInset - rect.right
      : 0
  dropdown.style.setProperty('--menu-shift', `${shift}px`)
}

/** 关闭全部顶部菜单。参数：无。 */
function closeMenus() {
  openMenu.value = null
  menuTrigger.value = null
}

/** 执行菜单动作后收起菜单。参数：action 为父组件提供的动作。 */
function runMenuAction(action: () => void) {
  closeMenus()
  action()
}

/** 打开问题反馈弹窗，首次打开时加载问卷 iframe。参数：无。 */
function openFeedback() {
  feedbackLoaded.value = true
  feedbackLoadFailed.value = false
  showFeedback.value = true
}

function handleFeedbackError() {
  feedbackLoadFailed.value = true
}

/** 处理页面外点击和 Esc，关闭当前菜单或打赏/反馈弹窗。参数：event 为鼠标或键盘事件。 */
function handleDocumentInteraction(event: MouseEvent | KeyboardEvent) {
  if (event instanceof KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (showDonate.value) showDonate.value = false
    else if (showFeedback.value) showFeedback.value = false
    else closeMenus()
    return
  }
  const target = event.target as Node
  if (!headerRef.value?.contains(target) && !dropdownRef.value?.contains(target)) closeMenus()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentInteraction)
  document.addEventListener('keydown', handleDocumentInteraction)
  window.addEventListener('resize', alignOpenMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentInteraction)
  document.removeEventListener('keydown', handleDocumentInteraction)
  window.removeEventListener('resize', alignOpenMenu)
})
</script>

<template>
  <header ref="headerRef" class="app-header">
    <div class="brand-lockup">
      <p>INFINITY NIKKI ALBUM</p>
      <h1>{{ messages.title }}</h1>
    </div>

    <div class="header-actions">
      <span class="header-star-hint" :title="messages.starHint">{{ messages.starHint }}</span>
      <div class="header-search">
        <input :value="searchQuery ?? ''" type="search" :placeholder="messages.searchPlaceholder" :aria-label="messages.searchPlaceholder" @input="emit('updateSearch', ($event.target as HTMLInputElement).value)" />
        <button v-if="searchQuery" type="button" :title="messages.clearSearch" :aria-label="messages.clearSearch" @click="emit('updateSearch', '')"><X :size="15" /></button>
      </div>

      <button
        class="header-icon-button refresh-album-button"
        type="button"
        :title="messages.refreshAlbum"
        :aria-label="messages.refreshAlbum"
        :disabled="!hasAlbumDirectory || isBusy || isRefreshing"
        @click="emit('refreshAlbum')"
      >
        <RefreshCw :size="17" :class="{ spinning: isRefreshing }" aria-hidden="true" />
        <span>{{ messages.refreshAlbum }}</span>
      </button>

      <div class="header-menu-wrap">
        <button
          class="header-menu-button album-name-button"
          type="button"
          :aria-label="messages.albumMenuAria"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'album'"
          @click.stop="toggleMenu('album', $event)"
        >
          <FolderOpen :size="16" aria-hidden="true" />
          <span>{{ hasAlbumDirectory ? directoryName : messages.currentAlbum }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <div v-if="openMenu === 'album'" ref="dropdownRef" class="header-dropdown" :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" role="menu">
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('chooseDirectory'))">
            <FolderOpen :size="16" />
            <span>{{ messages.chooseDirectory }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('clearDirectory'))">
            <Trash2 :size="16" />
            <span>{{ messages.clearDirectory }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('authorizeX6Game'))">
            <FolderOpen :size="16" />
            <span>{{ messages.authorizeX6Game }}</span>
          </button>
          </div>
        </Teleport>
      </div>

      <button
        class="header-icon-button cleanup-button"
        type="button"
        :title="messages.specialCleanup"
        :aria-label="messages.specialCleanup"
        @click="emit('openCleanup')"
      >
        <Eraser :size="17" aria-hidden="true" />
        <span>{{ messages.specialCleanup }}</span>
      </button>

      <div class="header-menu-wrap">
        <button
          class="header-menu-button view-menu-button"
          type="button"
          :aria-label="messages.viewMenuAria"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'view'"
          @click.stop="toggleMenu('view', $event)"
        >
          <Grid2X2 :size="16" aria-hidden="true" />
          <span>{{ messages.view }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <div v-if="openMenu === 'view'" ref="dropdownRef" class="header-dropdown view-dropdown" :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" role="menu">
          <button type="button" role="menuitem" @click="runMenuAction(() => emit('toggleTheme'))">
            <Sun v-if="themeMode === 'dark'" :size="16" />
            <Moon v-else :size="16" />
            <span>{{ messages.themeButton(themeMode) }}</span>
          </button>
          <div class="menu-section-label">{{ messages.thumbnail }}</div>
          <button
            v-for="option in thumbnailModeOptions"
            :key="option.value"
            class="menu-radio"
            :class="{ active: option.value === thumbnailMode }"
            type="button"
            role="menuitemradio"
            :aria-checked="option.value === thumbnailMode"
            @click="runMenuAction(() => emit('changeThumbnailMode', option.value))"
          >
            <span class="radio-mark"></span>
            <span>{{ option.label }}</span>
          </button>
          <div class="menu-separator"></div>
          <button type="button" role="menuitem" @click="runMenuAction(() => emit('toggleLanguage'))">
            <Languages :size="16" />
            <span>{{ messages.languageButton }}</span>
          </button>
          </div>
        </Teleport>
      </div>

      <button class="header-icon-button fortune-time-trigger" type="button" :title="messages.fortuneTime" :aria-label="messages.fortuneTime" @click="closeMenus(); showFortuneTime = true">
        <span aria-hidden="true">✦</span>
        <span>{{ messages.fortuneTime }}</span>
      </button>

      <div class="header-menu-wrap">
        <button
          class="header-icon-button more-menu-button"
          type="button"
          :title="messages.more"
          :aria-label="messages.moreMenuAria"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'more'"
          @click.stop="toggleMenu('more', $event)"
        >
          <MoreHorizontal :size="19" aria-hidden="true" />
          <span>{{ messages.more }}</span>
        </button>
        <Teleport to="body">
          <div v-if="openMenu === 'more'" ref="dropdownRef" class="header-dropdown header-dropdown-right" :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" role="menu">
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('clearCache'))">
            <RotateCcw :size="16" />
            <span>{{ messages.clearCache }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('clearData'))">
            <Trash2 :size="16" />
            <span>{{ messages.clearData }}</span>
          </button>
          <div class="menu-separator"></div>
          <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noreferrer" role="menuitem" @click="closeMenus">
            <Github :size="16" />
            <span>{{ messages.githubText }}</span>
          </a>
          <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noreferrer" role="menuitem" @click="closeMenus">
            <span class="text-icon">G</span>
            <span>{{ messages.giteeText }}</span>
          </a>
          <button type="button" role="menuitem" @click="closeMenus(); showDonate = true">
            <Heart :size="16" />
            <span>{{ messages.donate }}</span>
          </button>
          <button type="button" role="menuitem" @click="runMenuAction(openFeedback)">
            <Bug :size="16" />
            <span>{{ messages.feedback }}</span>
          </button>
          <button type="button" role="menuitem" @click="runMenuAction(() => emit('openAbout'))">
            <Info :size="16" />
            <span>{{ messages.about }}</span>
          </button>
          <div class="menu-author">{{ messages.author }}</div>
          <div class="author-social-links">
            <a class="author-social-link xiaohongshu-link" href="https://xhslink.com/m/3IEU0XhZ6e" target="_blank" rel="noopener noreferrer" role="menuitem" :title="messages.xiaohongshuAuthor" :aria-label="messages.xiaohongshuAuthor" @click="closeMenus">
              <BookHeart :size="17" aria-hidden="true" />
              <span>{{ messages.xiaohongshu }}</span>
            </a>
            <a class="author-social-link douyin-link" href="https://v.douyin.com/VdLd5oOXz8I/" target="_blank" rel="noopener noreferrer" role="menuitem" :title="messages.douyinAuthor" :aria-label="messages.douyinAuthor" @click="closeMenus">
              <Music2 :size="17" aria-hidden="true" />
              <span>{{ messages.douyin }}</span>
            </a>
          </div>
          </div>
        </Teleport>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="showDonate" class="help-dialog" role="dialog" aria-modal="true" :aria-label="messages.donateTitle" @click.self="showDonate = false">
        <section class="help-dialog-panel donate-dialog-panel">
          <header>
            <h2>{{ messages.donateTitle }}</h2>
            <button type="button" :aria-label="messages.closeDonate" :title="messages.closeDonate" @click="showDonate = false">
              <X :size="19" />
            </button>
          </header>
          <div class="donate-dialog-body">
            <p class="donate-description">{{ messages.donateDescription }}</p>
            <div class="donate-qrcodes">
              <figure>
                <img :src="wxQrCode" :alt="messages.donateWechat" />
                <figcaption>{{ messages.donateWechat }}</figcaption>
              </figure>
              <figure>
                <img :src="zfbQrCode" :alt="messages.donateAlipay" />
                <figcaption>{{ messages.donateAlipay }}</figcaption>
              </figure>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="showFeedback" class="help-dialog" role="dialog" aria-modal="true" :aria-label="messages.feedbackTitle" @click.self="showFeedback = false">
        <section class="help-dialog-panel feedback-dialog-panel">
          <header>
            <h2>{{ messages.feedbackTitle }}</h2>
            <button type="button" :aria-label="messages.feedbackClose" :title="messages.feedbackClose" @click="showFeedback = false">
              <X :size="19" />
            </button>
          </header>
          <div class="feedback-dialog-body">
            <iframe
              v-if="feedbackLoaded"
              class="feedback-iframe"
              :src="FEEDBACK_URL"
              :title="messages.feedbackTitle"
              referrerpolicy="strict-origin-when-cross-origin"
              @error="handleFeedbackError"
            ></iframe>
            <p v-if="feedbackLoadFailed" class="feedback-load-failed">{{ messages.feedbackOpenExternal }}</p>
            <a class="feedback-external-link" :href="FEEDBACK_URL" target="_blank" rel="noreferrer">{{ messages.feedbackOpenExternal }}</a>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>

  <FortuneTimeDialog :visible="showFortuneTime" :messages="fortuneMessages" @close="showFortuneTime = false" />
</template>
