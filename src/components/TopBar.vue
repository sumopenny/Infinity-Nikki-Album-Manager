<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BookHeart,
  ChevronDown,
  CircleHelp,
  Eraser,
  FolderOpen,
  Github,
  Grid2X2,
  Languages,
  Music2,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Sun,
  Trash2,
  X
} from 'lucide-vue-next'
import type { Language, LocaleMessages } from '../i18n'
import type { ThumbnailMode } from '../types/thumbnail'
import type { ThemeMode } from '../types/theme'

type OpenMenu = 'album' | 'view' | 'more' | null

const props = defineProps<{
  directoryName: string
  isLoading: boolean
  isRefreshing: boolean
  isDeleting: boolean
  isCleaningRelatedPhotos: boolean
  hasAlbumDirectory: boolean
  thumbnailMode: ThumbnailMode
  thumbnailModeOptions: Array<{ value: ThumbnailMode; label: string }>
  themeMode: ThemeMode
  language: Language
  messages: LocaleMessages['topBar']
}>()

const emit = defineEmits<{
  chooseDirectory: []
  clearDirectory: []
  refreshAlbum: []
  cleanRelatedPhotos: []
  toggleLanguage: []
  toggleTheme: []
  changeThumbnailMode: [mode: ThumbnailMode]
}>()

const openMenu = ref<OpenMenu>(null)
const showHelp = ref(false)
const headerRef = ref<HTMLElement | null>(null)
const isBusy = computed(() => props.isLoading || props.isDeleting || props.isCleaningRelatedPhotos)

/** 切换顶部菜单，并保证同一时间只展开一个菜单。参数：menu 为目标菜单。 */
async function toggleMenu(menu: Exclude<OpenMenu, null>) {
  openMenu.value = openMenu.value === menu ? null : menu
  await nextTick()
  alignOpenMenu()
}

/** 让菜单优先在触发项下方居中，并在临近屏幕边缘时保持完整可见。参数：无。 */
function alignOpenMenu() {
  const dropdown = headerRef.value?.querySelector<HTMLElement>('.header-dropdown')
  if (!dropdown) return
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
}

/** 执行菜单动作后收起菜单。参数：action 为父组件提供的动作。 */
function runMenuAction(action: () => void) {
  closeMenus()
  action()
}

/** 处理页面外点击和 Esc，关闭当前菜单或帮助弹窗。参数：event 为鼠标或键盘事件。 */
function handleDocumentInteraction(event: MouseEvent | KeyboardEvent) {
  if (event instanceof KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (showHelp.value) showHelp.value = false
    else closeMenus()
    return
  }
  if (!headerRef.value?.contains(event.target as Node)) closeMenus()
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

      <button
        class="header-icon-button"
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
          @click.stop="toggleMenu('album')"
        >
          <FolderOpen :size="16" aria-hidden="true" />
          <span>{{ hasAlbumDirectory ? directoryName : messages.currentAlbum }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <div v-if="openMenu === 'album'" class="header-dropdown" role="menu">
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('chooseDirectory'))">
            <FolderOpen :size="16" />
            <span>{{ messages.chooseDirectory }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('clearDirectory'))">
            <Trash2 :size="16" />
            <span>{{ messages.clearDirectory }}</span>
          </button>
          <div class="menu-separator"></div>
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('cleanRelatedPhotos'))">
            <Eraser :size="16" />
            <span>{{ isCleaningRelatedPhotos ? messages.cleaningRelated : messages.cleanRelatedPhotos }}</span>
          </button>
        </div>
      </div>

      <div class="header-menu-wrap">
        <button
          class="header-menu-button"
          type="button"
          :aria-label="messages.viewMenuAria"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'view'"
          @click.stop="toggleMenu('view')"
        >
          <Grid2X2 :size="16" aria-hidden="true" />
          <span>{{ messages.view }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <div v-if="openMenu === 'view'" class="header-dropdown view-dropdown" role="menu">
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
      </div>

      <div class="header-menu-wrap">
        <button
          class="header-icon-button"
          type="button"
          :title="messages.more"
          :aria-label="messages.moreMenuAria"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'more'"
          @click.stop="toggleMenu('more')"
        >
          <MoreHorizontal :size="19" aria-hidden="true" />
          <span>{{ messages.more }}</span>
        </button>
        <div v-if="openMenu === 'more'" class="header-dropdown header-dropdown-right" role="menu">
          <button type="button" role="menuitem" @click="closeMenus(); showHelp = true">
            <CircleHelp :size="16" />
            <span>{{ messages.help }}</span>
          </button>
          <a href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noreferrer" role="menuitem" @click="closeMenus">
            <Github :size="16" />
            <span>{{ messages.githubText }}</span>
          </a>
          <a href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noreferrer" role="menuitem" @click="closeMenus">
            <span class="text-icon">G</span>
            <span>{{ messages.giteeText }}</span>
          </a>
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
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="showHelp" class="help-dialog" role="dialog" aria-modal="true" :aria-label="messages.helpTitle" @click.self="showHelp = false">
        <section class="help-dialog-panel">
          <header>
            <h2>{{ messages.helpTitle }}</h2>
            <button type="button" :aria-label="messages.closeHelp" :title="messages.closeHelp" @click="showHelp = false">
              <X :size="19" />
            </button>
          </header>
          <div class="help-grid">
            <section>
              <h3>{{ messages.helpMouseTitle }}</h3>
              <p v-for="item in messages.helpMouseItems" :key="item">{{ item }}</p>
            </section>
            <section>
              <h3>{{ messages.helpKeyboardTitle }}</h3>
              <p v-for="item in messages.helpKeyboardItems" :key="item">{{ item }}</p>
            </section>
            <section>
              <h3>{{ messages.helpPathTitle }}</h3>
              <p class="help-path">{{ messages.helpPathText }}</p>
            </section>
            <section>
              <h3>{{ messages.helpSafetyTitle }}</h3>
              <p>{{ messages.helpSafetyText }}</p>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
