import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { expect, it } from 'vitest'

it('serves catalog JSON in real workerd and refuses redirects without caching failures', async () => {
  const bundled = await build({
    stdin: {
      contents: `
    import { onRequestGet } from './functions/api/gongeo/[[path]].ts';
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.redirect !== 'manual') throw new Error('Invalid redirect mode');
      return request.url.includes('/items/2') ? new Response(null, { status: 302 }) : Response.json({ id: 1 });
    };
    export default { fetch(request) {
      return onRequestGet({ request, params: { path: ['items', new URL(request.url).pathname.split('/').pop()] } });
    } };
  `,
      resolveDir: process.cwd(),
      loader: 'ts'
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false
  })
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: 'catalog-runtime-test',
          compatibilityDate: '2026-09-19',
          manifest: {
            mainModule: 'index.js',
            modules: { 'index.js': { type: 'esm', contents: bundled.outputFiles[0].text } }
          }
        }
      }
    ]
  })
  try {
    const success = await runtime.dispatchFetch('http://localhost/api/gongeo/items/1')
    expect(success.status).toBe(200)
    expect(await success.json()).toEqual({ id: 1 })
    expect(success.headers.get('cache-control')).toBe('public, max-age=300')
    const redirect = await runtime.dispatchFetch('http://localhost/api/gongeo/items/2')
    expect(redirect.status).toBe(502)
    expect(redirect.headers.get('cache-control')).toBe('no-store')
  } finally {
    await runtime.dispose()
  }
}, 15000)
