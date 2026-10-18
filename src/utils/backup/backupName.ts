/** 统一备份下载文件名，使用用户设备的本地时间。 */
export function backupBaseName(moduleName: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `NikkiCube_${moduleName}_${timestamp}`
}
