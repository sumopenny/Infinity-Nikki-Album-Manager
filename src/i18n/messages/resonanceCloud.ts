export const resonanceCloudMessages = {
  zh: {
    login: '登录', register: '注册', logout: '退出登录', upload: '上传云端', download: '从云端同步', delete: '删除云端存档',
    username: '账号名', password: '密码', confirmPassword: '确认密码', cancel: '取消', confirm: '确认', working: '处理中…',
    account: '当前账号', local: '本地记录', remote: '云端记录', count: '条',
    credentials: '账号名为 4～32 位英文字母、数字或下划线，不区分大小写；密码为 6～128 个字符，区分大小写。',
    persistent: '保持登录，直到主动退出或浏览器清除登录凭证。第一版不提供修改或找回密码，请妥善保存。',
    uploadWarning: '本地全部记录将完整覆盖云端，不受当前筛选影响。云端独有的记录会删除，本地不变。',
    downloadWarning: '云端全部记录将完整覆盖本地。本地独有的记录会删除，云端不变。建议先导出本地备份。',
    deleteWarning: '输入当前密码并确认，将删除全部云端共鸣记录。账号、登录状态和本地记录保留。',
    ready: '请核对账号和记录数量后确认。', success: '操作成功。', retry: '核实结果并重试', refresh: '重新读取预览',
    errors: {
      CREDENTIAL_FORMAT: '账号名或密码格式不符合要求。', PASSWORD_MISMATCH: '两次输入的密码不一致。',
      USERNAME_TAKEN: '该账号名已被使用。', CREDENTIALS: '账号名或密码错误。', LOGIN_REQUIRED: '请重新登录。',
      ACCOUNT_CHANGED: '其他页面已切换账号，请关闭窗口后重新登录或刷新页面。',
      CONFLICT: '云端已被其他设备更新，请重新读取预览并确认。', LOCAL_CHANGED: '本地记录已发生变化，请重新读取预览并确认。',
      LOCAL_READ_FAILED: '无法读取本地记录，请检查浏览器存储权限后重试。', LOCAL_SAVE_FAILED: '本地保存失败，原记录已保留。请检查浏览器存储空间或权限后重试。',
      EMPTY_LOCAL: '本地没有可上传的共鸣记录。', EMPTY_CLOUD: '云端暂无存档，本地数据未改变。',
      RATE_LIMIT: '操作过于频繁，请 15 分钟后重试。', TOO_LARGE: '记录超出云同步容量限制（整份 8 MiB、单条 64 KiB、最多 2000 条）。',
      UPLOAD_PENDING: '已有未完成上传，请重试原请求；中断上传最多保留 24 小时。',
      INVALID_DATA: '记录格式不完整或不受支持，未覆盖目标存档。', NOT_CONFIGURED: '云同步服务尚未配置，请检查 Pages 的 RESONANCE_DB 绑定和数据库迁移。',
      NETWORK: '网络中断，操作结果暂未确认。重试将先核实同一请求，避免重复覆盖。',
      SERVER_ERROR: '服务处理失败。请重试核实结果；仍失败时联系站点维护者。', FORBIDDEN: '请求来源校验失败，请在本站重新操作。'
    }
  },
  en: {
    login: 'Log in', register: 'Register', logout: 'Log out', upload: 'Upload to cloud', download: 'Sync from cloud', delete: 'Delete cloud save',
    username: 'Username', password: 'Password', confirmPassword: 'Confirm password', cancel: 'Cancel', confirm: 'Confirm', working: 'Working…',
    account: 'Account', local: 'Local records', remote: 'Cloud records', count: 'records',
    credentials: 'Username: 4–32 letters, digits or underscores, case-insensitive. Password: 6–128 characters, case-sensitive.',
    persistent: 'Stay signed in until you log out or your browser removes the credentials. Password changes and recovery are not available; keep your password safe.',
    uploadWarning: 'All local records will replace the cloud save, regardless of filters. Cloud-only records will be removed. Local data stays unchanged.',
    downloadWarning: 'All cloud records will replace local records. Local-only records will be removed. Cloud data stays unchanged. Export a local backup first if needed.',
    deleteWarning: 'Enter your current password to delete all cloud resonance records. Your account, login and local records will remain.',
    ready: 'Check the account and record counts before confirming.', success: 'Operation completed.', retry: 'Check result and retry', refresh: 'Refresh preview',
    errors: {
      CREDENTIAL_FORMAT: 'Invalid username or password format.', PASSWORD_MISMATCH: 'The passwords do not match.', USERNAME_TAKEN: 'This username is already taken.',
      CREDENTIALS: 'Incorrect username or password.', LOGIN_REQUIRED: 'Please log in again.', ACCOUNT_CHANGED: 'Another tab changed accounts. Close this dialog and log in again or refresh the page.',
      CONFLICT: 'Another device updated the cloud save. Refresh the preview and confirm again.', LOCAL_CHANGED: 'Local records changed. Refresh the preview and confirm again.',
      LOCAL_READ_FAILED: 'Could not read local records. Check browser storage permissions and retry.', LOCAL_SAVE_FAILED: 'Local save failed; previous records were retained. Check browser storage space or permissions and retry.',
      EMPTY_LOCAL: 'There are no local records to upload.', EMPTY_CLOUD: 'No cloud save exists. Local data is unchanged.', RATE_LIMIT: 'Too many attempts. Try again in 15 minutes.',
      TOO_LARGE: 'Cloud limits exceeded: 8 MiB total, 64 KiB per record, 2000 records.', INVALID_DATA: 'Invalid or unsupported records. The destination was not replaced.',
      UPLOAD_PENDING: 'Unfinished uploads exist. Retry the original request; abandoned uploads are retained for up to 24 hours.',
      NOT_CONFIGURED: 'Cloud sync is not configured. Check the Pages RESONANCE_DB binding and database migrations.', NETWORK: 'Connection lost; the result is not confirmed. Retry checks the same request before writing again.',
      SERVER_ERROR: 'The service could not finish. Retry to check the result; contact the site maintainer if it persists.', FORBIDDEN: 'Request origin check failed. Please try again on this site.'
    }
  }
}
