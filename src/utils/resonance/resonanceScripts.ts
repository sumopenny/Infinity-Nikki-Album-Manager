// 共鸣导入用的取 Cookie 脚本：书签脚本（拖到书签栏）与控制台脚本，内容参照上游共鸣录。

/** 从页面读取 UID 的片段：资料页存在 `UID: 123456` 的元素时取其数字部分。 */
const UID_SNIPPET =
  "[...document.querySelectorAll('div')].find(el=>el.textContent.startsWith('UID:'))?.textContent.replace('UID:','').trim()"
/** 从 Cookie 中取 momoToken（对应 Momo Token 字段）。 */
const TOKEN_SNIPPET = 'document.cookie.match(/momoToken=([^;]+)/)?.[1]'
/** 从 Cookie 中取 momoNid（对应 Momo ID 字段）。 */
const ID_SNIPPET = 'document.cookie.match(/momoNid=([^;]+)/)?.[1]'

/** 控制台方法：在美鸭梨页面控制台粘贴执行，输出 Cookie JSON。 */
export const resonanceConsoleScript =
  'console.log(JSON.stringify({roleid:' +
  UID_SNIPPET +
  ',token:' +
  TOKEN_SNIPPET +
  ',id:' +
  ID_SNIPPET +
  '}));'

/**
 * 书签方法：拖到书签栏后在美鸭梨站点点击执行。
 * 非美鸭梨站点会弹窗提示，避免在别的网站误用。
 */
export function resonanceBookmarkScript(invalidSiteMessage: string): string {
  return (
    'javascript:(function(){if(location.hostname!=="myl.nuanpaper.com"){alert(' +
    JSON.stringify(invalidSiteMessage) +
    ");return}prompt('Cookie:',JSON.stringify({roleid:" +
    UID_SNIPPET +
    ',token:' +
    TOKEN_SNIPPET +
    ',id:' +
    ID_SNIPPET +
    '}));})();'
  )
}

/**
 * 解析用户粘贴的 Cookie 文本。
 * 接受书签/控制台输出的 `{"roleid":...,"token":...,"id":...}` JSON；缺少 UID 时 roleid 为空字符串。
 */
export function parseResonanceCookie(text: string): { roleid: string; token: string; id: string } {
  if (!text.trim()) throw new Error('empty')
  // 上游输入框的占位示例使用单引号，先统一成合法 JSON 再解析。
  const parsed = JSON.parse(text.trim().replace(/'/g, '"')) as Record<string, unknown>
  const token = typeof parsed.token === 'string' ? parsed.token.trim() : ''
  const id = typeof parsed.id === 'string' ? parsed.id.trim() : ''
  if (!token || !id) throw new Error('invalid')
  const roleid =
    parsed.roleid === null || parsed.roleid === undefined ? '' : String(parsed.roleid).trim()
  return { roleid, token, id }
}
