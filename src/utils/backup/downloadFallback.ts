/** Files awaiting attachment to the export result notice; never persisted or uploaded. */
const pendingFiles = new Map<string, File[]>()

export function retainDownload(fileName: string, blob: Blob, module = 'default'): void {
  const files = pendingFiles.get(module) ?? []
  files.push(new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
  pendingFiles.set(module, files)
}

export function takeDownloadFiles(module = 'default'): File[] {
  const files = pendingFiles.get(module) ?? []
  pendingFiles.delete(module)
  return files
}

export function requestBlobDownload(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
