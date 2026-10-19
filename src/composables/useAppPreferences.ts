import { readLocalStorage, writeLocalStorage } from '../utils/localStorage'
import { computed, ref, watch, nextTick, onBeforeUnmount, type Ref } from 'vue'
import { DEFAULT_LANGUAGE, messages, type Language } from '../i18n'
import { isThumbnailMode, type ThumbnailMode } from '../types/thumbnail'
import { isThemeMode, type ThemeMode } from '../types/theme'
import type { StatusState } from './useOperationNotice'
const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const OUTFIT_THUMBNAIL_STORAGE_KEY = 'infinity-nikki-outfit-thumbnail-mode'
const HOME_THUMBNAIL_STORAGE_KEY = 'infinity-nikki-home-thumbnail-mode'
const THEME_STORAGE_KEY = 'infinity-nikki-theme-mode'
const LANGUAGE_STORAGE_KEY = 'infinity-nikki-language'
const AUTO_PARSE_ACTIONS_STORAGE_KEY = 'infinity-nikki-auto-parse-actions'

function isLanguage(value: string | null): value is Language {
  return value === 'zh' || value === 'en'
}

interface AppPreferencesOptions {
  compactLayout: Readonly<Ref<boolean>>
  canPersist: () => boolean
  onStatus: (status: StatusState) => void
}
/** 管理显示偏好及其持久化；移动端回退仅用于显示，不覆盖桌面保存值。 */
export function useAppPreferences({ compactLayout, canPersist, onStatus }: AppPreferencesOptions) {
  const storedThumbnailMode = readLocalStorage(THUMBNAIL_STORAGE_KEY)
  const storedOutfitThumbnailMode = readLocalStorage(OUTFIT_THUMBNAIL_STORAGE_KEY)
  const storedHomeThumbnailMode = readLocalStorage(HOME_THUMBNAIL_STORAGE_KEY)
  const storedThemeMode = readLocalStorage(THEME_STORAGE_KEY)
  const storedLanguage = readLocalStorage(LANGUAGE_STORAGE_KEY)
  const storedAutoParseActions = readLocalStorage(AUTO_PARSE_ACTIONS_STORAGE_KEY)

  const language = ref<Language>(isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE)
  const locale = computed(() => messages[language.value])
  const autoParseActionsEnabled = ref(storedAutoParseActions === 'true')
  const isPreferenceUpdating = ref(false)
  let themeSwitchFrame: number | undefined
  const thumbnailMode = ref<ThumbnailMode>(
    isThumbnailMode(storedThumbnailMode) ? storedThumbnailMode : 'default'
  )
  const outfitThumbnailMode = ref<ThumbnailMode>(
    isThumbnailMode(storedOutfitThumbnailMode) ? storedOutfitThumbnailMode : 'portrait-standard'
  )
  const homeThumbnailMode = ref<ThumbnailMode>(
    isThumbnailMode(storedHomeThumbnailMode) ? storedHomeThumbnailMode : 'wide'
  )
  // 手机半尺寸不可用：显示时回退普通 1:1，保留电脑端已保存的比例偏好。
  const effectivePhotoThumbnailMode = computed(() =>
    compactLayout.value && thumbnailMode.value === 'half' ? 'default' : thumbnailMode.value
  )
  const effectiveOutfitThumbnailMode = computed(() =>
    compactLayout.value && outfitThumbnailMode.value === 'half'
      ? 'default'
      : outfitThumbnailMode.value
  )
  const effectiveHomeThumbnailMode = computed(() =>
    compactLayout.value && homeThumbnailMode.value === 'half' ? 'default' : homeThumbnailMode.value
  )
  const themeMode = ref<ThemeMode>(isThemeMode(storedThemeMode) ? storedThemeMode : 'light')

  watch(
    language,
    (value) => {
      document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
      if (canPersist()) writeLocalStorage(LANGUAGE_STORAGE_KEY, value)
    },
    { immediate: true }
  )
  watch(
    themeMode,
    (value) => {
      const root = document.documentElement
      const isThemeChange = Boolean(root.dataset.theme && root.dataset.theme !== value)

      if (themeSwitchFrame !== undefined) window.cancelAnimationFrame(themeSwitchFrame)
      if (isThemeChange) root.classList.add('is-theme-switching')
      root.dataset.theme = value

      if (isThemeChange) {
        themeSwitchFrame = window.requestAnimationFrame(() => {
          themeSwitchFrame = window.requestAnimationFrame(() => {
            root.classList.remove('is-theme-switching')
            themeSwitchFrame = undefined
          })
        })
      }
    },
    { immediate: true }
  )
  watch(autoParseActionsEnabled, (value) => {
    if (canPersist()) writeLocalStorage(AUTO_PARSE_ACTIONS_STORAGE_KEY, String(value))
  })

  /** 应用语言或主题偏好，并显示加载及完成提示。参数：preference 为要切换的偏好。 */
  async function applyPreference(preference: 'language' | 'theme') {
    if (isPreferenceUpdating.value) return

    isPreferenceUpdating.value = true
    onStatus({
      type: 'custom',
      message: locale.value.app.preferencesUpdating,
      tone: 'info',
      loading: true
    })
    await new Promise<void>((resolve) => window.setTimeout(resolve, 280))

    if (preference === 'language') {
      language.value = language.value === 'zh' ? 'en' : 'zh'
    } else {
      themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
      if (canPersist()) writeLocalStorage(THEME_STORAGE_KEY, themeMode.value)
    }

    await nextTick()
    onStatus({
      type: 'custom',
      message:
        preference === 'language'
          ? locale.value.app.languageUpdated
          : locale.value.app.themeUpdated,
      tone: 'success'
    })
    isPreferenceUpdating.value = false
  }

  /** 切换中英文。参数：无。 */
  function toggleLanguage() {
    return applyPreference('language')
  }

  /** 切换亮暗主题。参数：无。 */
  function toggleTheme() {
    return applyPreference('theme')
  }

  function saveThumbnailMode(kind: 'photo' | 'outfit' | 'home', mode: ThumbnailMode) {
    const [state, key] =
      kind === 'home'
        ? ([homeThumbnailMode, HOME_THUMBNAIL_STORAGE_KEY] as const)
        : kind === 'outfit'
          ? ([outfitThumbnailMode, OUTFIT_THUMBNAIL_STORAGE_KEY] as const)
          : ([thumbnailMode, THUMBNAIL_STORAGE_KEY] as const)
    state.value = mode
    if (canPersist()) writeLocalStorage(key, mode)
  }
  onBeforeUnmount(() => {
    if (themeSwitchFrame !== undefined) window.cancelAnimationFrame(themeSwitchFrame)
    document.documentElement.classList.remove('is-theme-switching')
  })
  return {
    language,
    locale,
    themeMode,
    autoParseActionsEnabled,
    thumbnailMode,
    outfitThumbnailMode,
    homeThumbnailMode,
    effectivePhotoThumbnailMode,
    effectiveOutfitThumbnailMode,
    effectiveHomeThumbnailMode,
    toggleLanguage,
    toggleTheme,
    saveThumbnailMode
  }
}
