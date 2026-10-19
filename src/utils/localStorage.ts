// 本地设置读取失败时回退；写入失败不影响当前会话。
export function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 持久化不可用时保留当前会话状态。 */
  }
}

export function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 持久化不可用时不阻断当前操作。 */
  }
}
