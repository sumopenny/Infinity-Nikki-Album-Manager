import { handleWardrobeCloud } from '../../_lib/wardrobeCloud'
import type { CloudEnv } from '../../_lib/cloudShared'

export function onRequest(context: {
  request: Request
  env: CloudEnv
  data?: Record<string, unknown>
}) {
  return handleWardrobeCloud(context.request, context.env, (error, detail) => {
    if (context.data) context.data.diagnosticFailure = { error, ...detail }
  })
}
