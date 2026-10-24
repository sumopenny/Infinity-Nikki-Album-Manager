import { handleErrorReport, type ErrorEnv } from '../_lib/errorReporting'

/** 仅接收报告；没有公开的错误读取、查询或删除接口。 */
export function onRequest(context: { request: Request; env: ErrorEnv }) {
  return handleErrorReport(context.request, context.env)
}
