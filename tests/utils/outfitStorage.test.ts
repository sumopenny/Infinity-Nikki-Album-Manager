import { describe, expect, it } from 'vitest'
import { fileExists, readIgnoredShareCodes, readTags, writeIgnoredShareCodes } from '../../src/utils/outfit/outfitStorage'
class F { constructor(public name: string, public contents = '') {} async getFile() { const f=new File([this.contents],this.name); Object.defineProperty(f,'text',{value:async()=>this.contents}); return f } async createWritable() { return { write: async (v: string) => { this.contents = v }, close: async () => undefined, abort: async () => undefined } as any } }
class D { files = new Map<string, F>(); async getFileHandle(n: string, o?: any) { let f=this.files.get(n); if(!f&&o?.create){f=new F(n);this.files.set(n,f)}; if(!f) throw new DOMException('missing','NotFoundError'); return f as any } async removeEntry(n: string){if(!this.files.delete(n)) throw new DOMException('missing','NotFoundError')} }
const d = () => new D() as any
describe('outfitStorage', () => {
  it('creates defaults and filters tags', async () => { const x=d(); expect(await readTags(x)).toHaveLength(6); x.files.get('tags.json')!.contents=JSON.stringify(['甜美','甜美','全部','abcdef']); expect(await readTags(x)).toEqual(['甜美']) })
  it('reads and writes ignored share codes', async () => { const x=d(); x.files.set('ignored-sharecodes.json', new F('ignored-sharecodes.json', JSON.stringify([' A ', 'A', 2]))); expect([...await readIgnoredShareCodes(x)]).toEqual(['A']); await writeIgnoredShareCodes(x, new Set(['B'])); expect(JSON.parse(x.files.get('ignored-sharecodes.json')!.contents)).toEqual(['B']); await writeIgnoredShareCodes(x, new Set()); expect(x.files.has('ignored-sharecodes.json')).toBe(false) })
  it('reports file existence accurately', async () => { const x=d(); expect(await fileExists(x,'x')).toBe(false); x.files.set('x',new F('x')); expect(await fileExists(x,'x')).toBe(true) })
})
