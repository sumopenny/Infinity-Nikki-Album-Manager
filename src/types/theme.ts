export type ThemeMode = 'light' | 'dark'

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark'
}
