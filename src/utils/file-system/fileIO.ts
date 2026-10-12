function isMissingEntryError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

export async function writeBlob(handle: FileSystemFileHandle, value: Blob | string | Uint8Array): Promise<void> {
  const writable = await handle.createWritable()
  try { await writable.write(value); await writable.close() } catch (error) { await writable.abort(error).catch(() => undefined); throw error }
}

export async function writeJson(directory: FileSystemDirectoryHandle, name: string, value: unknown): Promise<void> {
  await writeBlob(await directory.getFileHandle(name, { create: true }), `${JSON.stringify(value, null, 2)}\n`)
}

export async function fileExists(directory: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try { await directory.getFileHandle(name); return true } catch (error) { if (isMissingEntryError(error)) return false; throw error }
}

