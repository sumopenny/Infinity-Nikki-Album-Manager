import { handleCloud, type CloudEnv } from '../../_lib/resonanceCloud'

/** Pages Functions 同源入口，通过 RESONANCE_DB 绑定访问共鸣专用 D1。 */
export function onRequest(context: { request: Request; env: CloudEnv }) {
  return handleCloud(context.request, context.env)
}
