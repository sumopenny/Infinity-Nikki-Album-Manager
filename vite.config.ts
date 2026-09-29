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
  const outfitCodeProxy = {
    target: 'https://x6cn-clothdiydata.nuanpaper.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api\/outfit-code/, '/default') + '.json'
  }
  const apiProxy = remoteApiOrigin
    ? {
        // 搭配码数据始终由本地 Vite 直连对象存储，不依赖已部署的 Pages Function。
        '/api/outfit-code': outfitCodeProxy,
        // 图鉴 API 通过本地开发服务器转发，避免浏览器直接触发跨域限制。
        '/api/gongeo': {
          target: 'https://data.gongeo.us',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/gongeo/, '/v1')
        },
        // 远程 D1 点赞接口仍转发到 Pages 服务。
        '/api': {
          target: remoteApiOrigin,
          changeOrigin: true,
          secure: remoteApiOrigin.startsWith('https://')
        }
      }
    : {
        // 分享码路径由浏览器 WASM 解出，本地开发服务器代取原始对象以避开浏览器 CORS。
        '/api/outfit-code': outfitCodeProxy,
        // 图鉴 API 通过本地开发服务器转发，避免浏览器直接触发跨域限制。
        '/api/gongeo': {
          target: 'https://data.gongeo.us',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/gongeo/, '/v1')
        }
      }

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: apiProxy
    },
    preview: {
      host: '0.0.0.0',
      port: 4173
    }
  }
})
