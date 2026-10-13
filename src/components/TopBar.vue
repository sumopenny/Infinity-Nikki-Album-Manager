<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BookHeart,
  Download,
  Upload,
  Bug,
  ChevronLeft,
  Eraser,
  FolderOpen,
  Github,
  Globe,
  Grid2X2,
  Heart,
  History,
  BookOpen,
  Music2,
  Moon,
  MoreHorizontal,
  Wrench,
  RotateCcw,
  ScanSearch,
  Search,
  Sun,
  Trash2,
  X
} from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
import { useModalFocus } from '../composables/useModalFocus'
import { useModalPresence } from '../composables/useModalPresence'
import type { AlbumView } from './AlbumViewSwitcher.vue'
import LikeCounter from './LikeCounter.vue'
// 收款码图片，通过 Vite 打包以保证构建后路径正确
import wxQrCode from '../../img/wx.jpg'
import zfbQrCode from '../../img/zfb.jpg'
import type { Language, LocaleMessages } from '../i18n'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import type { ThumbnailMode } from '../types/thumbnail'
import type { ThemeMode } from '../types/theme'
import brandIcon from '../../img/wxnn.ico'

type OpenMenu = 'album' | 'view' | 'tools' | 'more' | null

const props = defineProps<{
  viewMessages?: LocaleMessages['viewNav']
  directorySupported?: boolean
  directoryName: string
  isLoading: boolean
  backupDisabled?: boolean
  hasBackupData?: boolean
  isDeleting: boolean
  hasAlbumDirectory: boolean
  hasX6GameAuthorization: boolean
  thumbnailMode: ThumbnailMode
  thumbnailModeDisabled?: boolean
  thumbnailModeOptions: Array<{ value: ThumbnailMode; label: string }>
  themeMode: ThemeMode
  language: Language
  messages: LocaleMessages['topBar']
  searchQuery?: string
  activeView?: AlbumView
}>()

const emit = defineEmits<{
  changeView: [view: AlbumView]
  chooseDirectory: []
  clearDirectory: []
  authorizeX6Game: []
  openCleanup: []
  openFortuneTime: []
  openParseTools: []
  clearCache: []
  clearData: []
  exportAllData: []
  importAllData: []
  refreshBackupAvailability: []
  toggleLanguage: []
  toggleTheme: []
  changeThumbnailMode: [mode: ThumbnailMode]
  openUpdateLog: []
  openHelpAbout: []
  updateSearch: [value: string]
}>()

// 问题反馈问卷地址：发布问卷星/腾讯问卷后，把链接替换到这里即可
const FEEDBACK_URL = 'https://v.wjx.cn/vm/tUM7gga.aspx'

const compact = useCompactLayout()
const mobileSearchOpen = ref(false)
const mobileSearchInput = ref<HTMLInputElement | null>(null)
const mobileSearchTrigger = ref<HTMLButtonElement | null>(null)
const mobileSearchStyle = ref({ top: '72px' })
let restoreMobileSearchFocus = false
let headerResizeObserver: ResizeObserver | null = null
const openMenu = ref<OpenMenu>(null)
const menuMotion = useModalPresence(computed(() => compact.value && openMenu.value !== null), compact)
const menuStyle = computed(() => compact.value ? {} : { top: `${menuPosition.value.top}px`, left: `${menuPosition.value.left}px` })
watch(compact, () => closeMenus())
watch(() => props.activeView, () => closeMenus())
defineExpose({ closeMenus })
const showDonate = ref(false)
const showFeedback = ref(false)
useBodyScrollLock(computed(() => showDonate.value || showFeedback.value || menuMotion.present.value))
// iframe 懒加载：首次打开弹窗时才设置 src，避免启动时请求第三方页面
const feedbackLoaded = ref(false)
const feedbackLoadFailed = ref(false)
const headerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const menuTrigger = ref<HTMLElement | null>(null)
useModalFocus(menuMotion.present, dropdownRef, closeMenus, menuTrigger)
const menuPosition = ref({ top: 0, left: 0 })
const isBusy = computed(() => props.isLoading || props.isDeleting)

/** 切换顶部菜单，并保证同一时间只展开一个菜单。参数：menu 为目标菜单。 */
async function toggleMenu(menu: Exclude<OpenMenu, null>, event: MouseEvent) {
  closeMobileSearch(false)
  if (openMenu.value === menu) {
    closeMenus()
    return
  }

  menuTrigger.value = event.currentTarget as HTMLElement
  openMenu.value = menu
  if (menu === 'more') emit('refreshBackupAvailability')
  await nextTick()
  await alignOpenMenu()
  if (compact.value) dropdownRef.value?.focus()
}

/** 让菜单优先在触发项下方居中，并在临近屏幕边缘时保持完整可见。参数：无。 */
async function alignOpenMenu() {
  updateMobileSearchPosition()
  const dropdown = dropdownRef.value
  const trigger = menuTrigger.value
  if (!dropdown || !trigger || compact.value) return

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
  // 横向对齐之外也约束可视高度，短窗口下菜单内部滚动。
  const viewportBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight)
  const availableBelow = viewportBottom - triggerRect.bottom - 19
  const availableAbove = triggerRect.top - 19
  if (availableBelow < Math.min(dropdown.scrollHeight, 240) && availableAbove > availableBelow) {
    dropdown.style.maxHeight = `${Math.max(48, availableAbove)}px`
    menuPosition.value.top = Math.max(12, triggerRect.top - Math.min(dropdown.scrollHeight, availableAbove) - 7)
  } else dropdown.style.maxHeight = `${Math.max(48, availableBelow)}px`
}

/** 关闭手机搜索浮层；显式关闭后等待淡出结束再还原焦点，保留关键词。 */
function closeMobileSearch(restoreFocus = true) {
  // 菜单或外部操作可在淡出期间取消焦点恢复，避免抢走新窗口的焦点。
  if (!restoreFocus) restoreMobileSearchFocus = false
  if (!mobileSearchOpen.value) return
  restoreMobileSearchFocus = restoreFocus
  mobileSearchOpen.value = false
}

/** 淡出完成后恢复显式关闭的焦点；重新打开或切换菜单时不恢复。 */
function finishMobileSearchClose() {
  const shouldRestore = restoreMobileSearchFocus
  restoreMobileSearchFocus = false
  if (shouldRestore && compact.value && !mobileSearchOpen.value && !openMenu.value) mobileSearchTrigger.value?.focus()
}

/** 搜索独立浮于顶栏下方，与菜单互斥；挂载后聚焦输入框。 */
async function toggleMobileSearch() {
  if (mobileSearchOpen.value) { closeMobileSearch(); return }
  closeMenus()
  mobileSearchOpen.value = true
  updateMobileSearchPosition()
  await nextTick()
  if (mobileSearchOpen.value) { mobileSearchInput.value?.focus(); updateMobileSearchPosition() }
}

/** 独立搜索层跟随顶栏实际底边，避开父级背景模糊的采样限制。 */
function updateMobileSearchPosition() {
  if (!mobileSearchOpen.value || !headerRef.value) return
  mobileSearchStyle.value = { top: `${Math.round(headerRef.value.getBoundingClientRect().bottom + 8)}px` }
}

/** 清除关键词但保留搜索浮层及输入焦点。 */
function clearMobileSearch() {
  emit('updateSearch', '')
  mobileSearchInput.value?.focus()
}

/** 关闭全部顶部菜单及搜索浮层，不抢占下一项操作的焦点。 */
function closeMenus() {
  closeMobileSearch(false)
  openMenu.value = null
}

/** 执行菜单动作后收起菜单。参数：action 为父组件提供的动作。 */
function runMenuAction(action: () => void) {
  closeMenus()
  action()
}

/** 视图菜单里的主题胶囊：只有点到与当前不同的那半边才触发切换。参数：mode 为目标主题。 */
function selectTheme(mode: ThemeMode) {
  if (mode !== props.themeMode) emit('toggleTheme')
}

/** 视图菜单里的语言胶囊：只有点到与当前不同的那半边才触发切换。参数：language 为目标语言。 */
function selectLanguage(language: Language) {
  if (language !== props.language) emit('toggleLanguage')
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
    if (mobileSearchOpen.value) { closeMobileSearch(); return }
    if (showDonate.value) showDonate.value = false
    else if (showFeedback.value) showFeedback.value = false
    else closeMenus()
    return
  }
  const target = event.target as Node
  // 关闭后元素引用会被清空，按原始路径识别浮层，避免取消尚未完成的焦点恢复。
  const insideSearch = event.composedPath().some(node => node instanceof HTMLElement && node.id === 'mobile-search-popover')
  if (mobileSearchOpen.value && !insideSearch && !mobileSearchTrigger.value?.contains(target)) closeMobileSearch(false)
  if (!headerRef.value?.contains(target) && !insideSearch && !dropdownRef.value?.contains(target) && !menuTrigger.value?.contains(target)) closeMenus()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentInteraction)
  document.addEventListener('keydown', handleDocumentInteraction)
  window.addEventListener('resize', alignOpenMenu)
  window.addEventListener('scroll', alignOpenMenu, true)
  window.visualViewport?.addEventListener('resize', updateMobileSearchPosition)
  window.visualViewport?.addEventListener('scroll', updateMobileSearchPosition)
  if (typeof ResizeObserver !== 'undefined' && headerRef.value) {
    headerResizeObserver = new ResizeObserver(updateMobileSearchPosition)
    headerResizeObserver.observe(headerRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentInteraction)
  document.removeEventListener('keydown', handleDocumentInteraction)
  window.removeEventListener('resize', alignOpenMenu)
  window.removeEventListener('scroll', alignOpenMenu, true)
  window.visualViewport?.removeEventListener('resize', updateMobileSearchPosition)
  window.visualViewport?.removeEventListener('scroll', updateMobileSearchPosition)
  headerResizeObserver?.disconnect()
})
</script>

<template>
  <header ref="headerRef" class="app-header">
    <div class="brand-lockup">
      <img class="brand-icon" :src="brandIcon" :alt="messages.brandName" />
      <div class="brand-copy">
        <p class="brand-subtitle">{{ messages.subtitle }}</p>
        <div class="brand-title-row">
          <h1>{{ messages.brandName }}</h1>
          <span class="brand-logo">{{ messages.logo }}</span>
        </div>
      </div>
    </div>

    <div v-if="compact" class="mobile-header-row">
      <button ref="mobileSearchTrigger" type="button" :class="{ 'has-search': searchQuery?.trim() }" :aria-label="language === 'zh' ? '搜索当前页面' : 'Search this page'" aria-controls="mobile-search-popover" :aria-expanded="mobileSearchOpen" @click="toggleMobileSearch"><Search :size="20" aria-hidden="true" /></button>
      <button type="button" :title="messages.view" :aria-label="messages.viewMenuAria" aria-haspopup="menu" :aria-expanded="openMenu === 'view'" @click.stop="toggleMenu('view', $event)"><Grid2X2 :size="20" aria-hidden="true" /></button>
      <button type="button" :aria-label="messages.moreMenuAria" :aria-expanded="openMenu === 'more'" @click.stop="toggleMenu('more', $event)"><MoreHorizontal :size="22" /></button>
    </div>
    <Teleport to="body"><Transition name="mobile-search-popover" @after-leave="finishMobileSearchClose">
      <div v-if="compact && mobileSearchOpen" id="mobile-search-popover" class="mobile-header-search" :style="mobileSearchStyle" role="search" :aria-label="messages.searchPlaceholder">
        <Search :size="18" aria-hidden="true" />
        <input ref="mobileSearchInput" type="search" :value="searchQuery" :placeholder="messages.searchPlaceholder" :aria-label="messages.searchPlaceholder" @input="emit('updateSearch', ($event.target as HTMLInputElement).value)" />
        <button v-if="searchQuery" type="button" :aria-label="language === 'zh' ? '清除搜索' : 'Clear search'" @click="clearMobileSearch"><Eraser :size="18" /></button>
        <button type="button" :aria-label="language === 'zh' ? '关闭搜索' : 'Close search'" @click="closeMobileSearch()"><X :size="18" /></button>
      </div>
    </Transition></Teleport>
    <div v-show="!compact" class="header-actions">
      <span class="header-star-hint" :title="messages.starHint">{{ messages.starHint }}</span>
      <a
        class="official-site-link"
        href="https://nikki3.pages.dev/"
        target="_blank"
        rel="noopener noreferrer"
        :title="messages.officialSiteHint"
        :aria-label="messages.officialSiteHint"
      >
        <span class="official-site-glow" aria-hidden="true"></span>
        <Globe :size="16" aria-hidden="true" class="official-site-icon" />
        <span class="official-site-text">{{ messages.officialSite }}</span>
        <span class="official-site-spark" aria-hidden="true">✦</span>
      </a>
      <LikeCounter :messages="{ like: messages.like, likeTooltip: messages.likeTooltip }" />
      <div class="header-search">
        <input :value="searchQuery ?? ''" type="search" :placeholder="messages.searchPlaceholder" :aria-label="messages.searchPlaceholder" @input="emit('updateSearch', ($event.target as HTMLInputElement).value)" />
        <button v-if="searchQuery" type="button" :title="messages.clearSearch" :aria-label="messages.clearSearch" @click="emit('updateSearch', '')"><X :size="15" /></button>
      </div>

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
          <ChevronLeft class="header-menu-chevron" :class="{ 'is-open': openMenu === 'album' }" :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <Transition name="mobile-menu" :css="compact" @before-enter="menuMotion.beforeEnter" @before-leave="menuMotion.beforeLeave" @after-leave="menuMotion.afterLeave">
          <div v-if="openMenu === 'album'" ref="dropdownRef" tabindex="-1" :aria-label="messages.more" class="header-dropdown" :class="{ 'mobile-menu-sheet': compact }" :style="menuStyle" role="menu">
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('chooseDirectory'))">
            <FolderOpen :size="16" />
            <span>{{ messages.chooseDirectory }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="!hasAlbumDirectory || isBusy" @click="runMenuAction(() => emit('clearDirectory'))">
            <Trash2 :size="16" />
            <span>{{ messages.clearDirectory }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('authorizeX6Game'))">
            <FolderOpen :size="16" />
            <span>{{ hasX6GameAuthorization ? messages.reauthorizeX6Game : messages.authorizeX6Game }}</span>
          </button>
          </div>
          </Transition>
        </Teleport>
      </div>

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
          <ChevronLeft class="header-menu-chevron" :class="{ 'is-open': openMenu === 'view' }" :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <Transition name="mobile-menu" :css="compact" @before-enter="menuMotion.beforeEnter" @before-leave="menuMotion.beforeLeave" @after-leave="menuMotion.afterLeave">
          <div v-if="openMenu === 'view'" ref="dropdownRef" tabindex="-1" :aria-label="messages.more" class="header-dropdown view-dropdown" :class="{ 'mobile-menu-sheet': compact }" :style="menuStyle" role="menu">
          <header v-if="compact" class="mobile-menu-heading"><h2>{{ messages.view }}</h2><button type="button" :aria-label="language === 'zh' ? '关闭菜单' : 'Close menu'" @click="closeMenus"><X :size="20" /></button></header>
          <div class="view-toggle-row">
            <div class="view-toggle-pill" role="group" :aria-label="messages.themeToggleAria">
              <button
                type="button"
                class="view-toggle-option"
                :class="{ active: themeMode === 'light' }"
                :aria-pressed="themeMode === 'light'"
                :title="messages.themeLight"
                :aria-label="messages.themeLight"
                @click="selectTheme('light')"
              >
                <Sun :size="15" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="view-toggle-option"
                :class="{ active: themeMode === 'dark' }"
                :aria-pressed="themeMode === 'dark'"
                :title="messages.themeDark"
                :aria-label="messages.themeDark"
                @click="selectTheme('dark')"
              >
                <Moon :size="15" aria-hidden="true" />
              </button>
            </div>
            <div class="view-toggle-pill" role="group" :aria-label="messages.languageToggleAria">
              <button
                type="button"
                class="view-toggle-option"
                :class="{ active: language === 'zh' }"
                :aria-pressed="language === 'zh'"
                @click="selectLanguage('zh')"
              >
                <span>{{ messages.languageZh }}</span>
              </button>
              <button
                type="button"
                class="view-toggle-option"
                :class="{ active: language === 'en' }"
                :aria-pressed="language === 'en'"
                @click="selectLanguage('en')"
              >
                <span>{{ messages.languageEn }}</span>
              </button>
            </div>
          </div>
          <div class="menu-section-label">{{ messages.thumbnail }}</div>
          <div class="thumbnail-options">
            <button
              v-for="option in thumbnailModeOptions"
              :key="option.value"
              class="menu-radio"
              :class="{ active: option.value === thumbnailMode }"
              type="button"
              role="menuitemradio"
              :disabled="thumbnailModeDisabled || (compact && option.value === 'half')"
              :aria-checked="option.value === thumbnailMode"
              @click="runMenuAction(() => emit('changeThumbnailMode', option.value))"
            >
              <span class="radio-mark"></span>
              <span>{{ option.label }}</span>
            </button>
          </div>
          </div>
          </Transition>
        </Teleport>
      </div>

      <div class="header-menu-wrap">
        <button class="header-icon-button tools-menu-button" type="button" :title="messages.tools" :aria-label="messages.toolsMenuAria" aria-haspopup="menu" :aria-expanded="openMenu === 'tools'" @click.stop="toggleMenu('tools', $event)">
          <Wrench :size="17" aria-hidden="true" />
          <span>{{ messages.tools }}</span>
          <ChevronLeft class="header-menu-chevron" :class="{ 'is-open': openMenu === 'tools' }" :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <Transition name="mobile-menu" :css="compact" @before-enter="menuMotion.beforeEnter" @before-leave="menuMotion.beforeLeave" @after-leave="menuMotion.afterLeave">
          <div v-if="openMenu === 'tools'" ref="dropdownRef" tabindex="-1" :aria-label="messages.more" class="header-dropdown" :class="{ 'mobile-menu-sheet': compact }" :style="menuStyle" role="menu">
            <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('openCleanup'))"><Eraser :size="16" /><span>{{ messages.specialCleanup }}</span></button>
            <button type="button" role="menuitem" @click="runMenuAction(() => emit('openFortuneTime'))"><span class="menu-symbol" aria-hidden="true">✦</span><span>{{ messages.fortuneTime }}</span></button>
            <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('openParseTools'))"><ScanSearch :size="16" /><span>{{ messages.parseTools }}</span></button>
          </div>
          </Transition>
        </Teleport>
      </div>

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
          <ChevronLeft class="header-menu-chevron" :class="{ 'is-open': openMenu === 'more' }" :size="14" aria-hidden="true" />
        </button>
        <Teleport to="body">
          <Transition name="mobile-menu" :css="compact" @before-enter="menuMotion.beforeEnter" @before-leave="menuMotion.beforeLeave" @after-leave="menuMotion.afterLeave">
          <div v-if="openMenu === 'more'" ref="dropdownRef" tabindex="-1" :aria-label="messages.more" class="header-dropdown header-dropdown-right more-menu-panel" :class="{ 'mobile-menu-sheet': compact }" :style="menuStyle" role="menu">
          <header v-if="compact" class="mobile-menu-heading"><h2>{{ messages.more }}</h2><button type="button" :aria-label="language === 'zh' ? '关闭菜单' : 'Close menu'" @click="closeMenus"><X :size="20" /></button></header>
          <div class="more-menu-content">
          <template v-if="compact">
            <button type="button" role="menuitem" @click="runMenuAction(() => emit('openParseTools'))"><ScanSearch :size="18" />{{ messages.parseTools }}</button>
            <button type="button" role="menuitem" @click="runMenuAction(() => emit('openFortuneTime'))">✦ {{ messages.fortuneTime }}</button>
            <template v-if="directorySupported !== false">
              <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('changeView', 'all'))">{{ viewMessages?.allPhotos }}</button>
              <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('changeView', 'trash'))">{{ viewMessages?.recentlyDeleted }}</button>
              <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('chooseDirectory'))"><FolderOpen :size="18" />{{ messages.chooseDirectory }}</button>
              <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('openCleanup'))">{{ messages.specialCleanup }}</button>
            </template>
            <p v-else class="mobile-capability-note">{{ language === 'zh' ? '相册与专项清理需在支持目录授权的电脑浏览器使用；手机可使用搭配、家园、相机参数和共鸣，并导入电脑备份。' : 'Album access and cleanup require a supported desktop browser. Use outfits, home schemes, camera parameters and resonance here, or import a desktop backup.' }}</p>
            <a class="mobile-official-link" href="https://nikki3.pages.dev/" target="_blank" rel="noopener noreferrer"><Globe :size="18" />{{ messages.officialSite }}</a>
            <div class="menu-separator"></div>
          </template>
          <button type="button" role="menuitem" :disabled="isBusy || backupDisabled || !hasBackupData" @click="runMenuAction(() => emit('exportAllData'))"><Upload :size="16" /><span>{{ messages.exportAllData }}</span></button>
          <button type="button" role="menuitem" :disabled="isBusy || backupDisabled" @click="runMenuAction(() => emit('importAllData'))"><Download :size="16" /><span>{{ messages.importAllData }}</span></button>
          <div class="menu-separator"></div>
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('clearCache'))">
            <RotateCcw :size="16" />
            <span>{{ messages.clearCache }}</span>
          </button>
          <button type="button" role="menuitem" :disabled="isBusy" @click="runMenuAction(() => emit('clearData'))">
            <Trash2 :size="16" />
            <span>{{ messages.clearData }}</span>
          </button>
          <div class="menu-separator"></div>
          <button type="button" role="menuitem" @click="closeMenus(); showDonate = true">
            <Heart :size="16" />
            <span>{{ messages.donate }}</span>
          </button>
          <button type="button" role="menuitem" @click="runMenuAction(openFeedback)">
            <Bug :size="16" />
            <span>{{ messages.feedback }}</span>
          </button>
          <button type="button" role="menuitem" @click="runMenuAction(() => emit('openUpdateLog'))">
            <History :size="16" />
            <span>{{ messages.updateLog }}</span>
          </button>
          <button type="button" role="menuitem" @click="runMenuAction(() => emit('openHelpAbout'))">
            <BookOpen :size="16" />
            <span>{{ messages.helpAbout }}</span>
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
            <a class="author-social-link" href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noopener noreferrer" role="menuitem" :title="messages.githubRepo" :aria-label="messages.githubRepo" @click="closeMenus">
              <Github :size="17" aria-hidden="true" />
              <span>{{ messages.githubText }}</span>
            </a>
            <a class="author-social-link" href="https://gitee.com/sumopenny/Infinity-Nikki-Album-Manager" target="_blank" rel="noopener noreferrer" role="menuitem" :title="messages.giteeRepo" :aria-label="messages.giteeRepo" @click="closeMenus">
              <span class="text-icon" aria-hidden="true">G</span>
              <span>{{ messages.giteeText }}</span>
            </a>
          </div>
          </div>
          </div>
          </Transition>
        </Teleport>
      </div>
    </div>
    <Teleport to="body"><Transition name="mobile-backdrop"><div v-if="compact && openMenu" class="mobile-menu-backdrop" @click="closeMenus"></div></Transition></Teleport>
  </header>

  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="showDonate" class="dialog-overlay" role="dialog" aria-modal="true" :aria-label="messages.donateTitle" @click.self="showDonate = false">
        <section class="dialog-panel donate-dialog-panel">
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
      <div v-if="showFeedback" class="dialog-overlay" role="dialog" aria-modal="true" :aria-label="messages.feedbackTitle" @click.self="showFeedback = false">
        <section class="dialog-panel feedback-dialog-panel">
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

</template>
