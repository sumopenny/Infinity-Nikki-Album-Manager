/** Write text to the system clipboard and report whether the operation succeeded. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text || !navigator.clipboard) return false
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
