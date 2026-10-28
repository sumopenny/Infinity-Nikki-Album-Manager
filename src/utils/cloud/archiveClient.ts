import { requestCloud, type CloudUser } from './cloudClient'
import {
  validateArchiveHead,
  validateArchiveSnapshot,
  type ArchiveModule,
  type ArchiveWrite
} from './archiveSchema'

export async function getArchiveHead(user: CloudUser) {
  const result = await requestCloud('/api/archive/cloud', 'summary', user)
  validateArchiveHead(result)
  return result
}
export async function getArchiveSnapshot(user: CloudUser, selected: ArchiveModule[]) {
  const result = await requestCloud(
    `/api/archive/cloud?modules=${selected.join(',')}`,
    'snapshot',
    user
  )
  return validateArchiveSnapshot(result, selected)
}
export async function writeArchive(
  action: 'upload' | 'delete',
  user: CloudUser,
  body: ArchiveWrite
) {
  const result = await requestCloud<{
    revisions?: Partial<Record<ArchiveModule, number>>
    replayed?: boolean
  }>('/api/archive/cloud', action, user, body)
  if (
    typeof result.replayed !== 'boolean' ||
    !result.revisions ||
    Object.entries(body.modules).some(
      ([key, value]) => result.revisions?.[key as ArchiveModule] !== value!.revision + 1
    )
  )
    throw new Error('SERVER_ERROR')
  return result
}
