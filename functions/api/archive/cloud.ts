import { handleArchiveCloud } from '../../_lib/archiveCloud'
import type { CloudEnv } from '../../_lib/cloudShared'

export function onRequest(context: {
  request: Request
  env: CloudEnv
  data?: Record<string, unknown>
}) {
  return handleArchiveCloud(context.request, context.env, (error, detail) => {
    if (context.data) context.data.diagnosticFailure = { error, ...detail }
  })
}
