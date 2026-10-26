import { requestCloud, type CloudUser } from '../cloud/cloudClient'
import {
  validateWardrobeCloudHead,
  validateWardrobeCloudSnapshot,
  type WardrobeCloudHead,
  type WardrobeCloudWrite
} from './wardrobeCloudSchema'

const path = '/api/wardrobe/cloud'
export async function getWardrobeHead(user: CloudUser) {
  const result = await requestCloud<WardrobeCloudHead>(path, 'summary', user)
  validateWardrobeCloudHead(result)
  return result
}
export async function getWardrobeSnapshot(user: CloudUser) {
  return validateWardrobeCloudSnapshot(await requestCloud(path, 'snapshot', user))
}
export async function writeWardrobeSnapshot(
  action: 'upload' | 'delete',
  user: CloudUser,
  body: WardrobeCloudWrite
) {
  const result = await requestCloud<{ revision: number; replayed: boolean }>(
    path,
    action,
    user,
    body
  )
  if (
    !Number.isSafeInteger(result.revision) ||
    result.revision !== body.revision + 1 ||
    typeof result.replayed !== 'boolean'
  )
    throw new Error('SERVER_ERROR')
  return result
}
