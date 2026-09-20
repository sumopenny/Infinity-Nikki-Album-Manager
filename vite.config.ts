import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function getRemoteApiOrigin(mode: string): string | undefined {
  if (mode !== 'remote') return undefined

  const rawOrigin = loadEnv(mode, process.cwd(), '').REMOTE_API_ORIGIN?.trim()
  if (!rawOrigin) {
    throw new Error('remote mode requires REMOTE_API_ORIGIN, for example https://example.pages.dev')
  }

  let origin: URL
  try {
    origin = new URL(rawOrigin)
  } catch {
    throw new Error(`REMOTE_API_ORIGIN is not a valid URL: ${rawOrigin}`)
  }

  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    throw new Error('REMOTE_API_ORIGIN must use http:// or https://')
  }

  return origin.origin
}

export default defineConfig(({ mode }) => {
  const remoteApiOrigin = getRemoteApiOrigin(mode)

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      ...(remoteApiOrigin
        ? {
            // 只代理 API，静态资源仍由本地 Vite 提供；浏览器不会接触 D1 凭据。
            proxy: {
              '/api': {
                target: remoteApiOrigin,
                changeOrigin: true,
                secure: remoteApiOrigin.startsWith('https://')
              }
            }
          }
        : {})
    },
    preview: {
      host: '0.0.0.0',
      port: 4173
    }
  }
})
