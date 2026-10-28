/** 账号认证及云端传输共用文案，不依赖任何业务模块。 */
export const cloudMessages = {
  zh: {
    login: '登录',
    register: '注册',
    logout: '退出登录',
    username: '账号名',
    password: '密码',
    confirmPassword: '确认密码',
    cancel: '取消',
    confirm: '确认',
    working: '处理中…',
    account: '当前账号',
    credentials:
      '账号名为 4～32 位英文字母、数字或下划线，不区分大小写；密码为 6～128 个字符，区分大小写。',
    success: '操作成功。',
    loginSuccess: '登录成功',
    registerSuccess: '注册成功',
    retry: '核实结果并重试',
    refresh: '重新读取预览',
    errors: {
      CREDENTIAL_FORMAT: '账号名或密码格式不符合要求。',
      PASSWORD_MISMATCH: '两次输入的密码不一致。',
      USERNAME_TAKEN: '该账号名已被使用。',
      CREDENTIALS: '账号名或密码错误。',
      LOGIN_REQUIRED: '请重新登录。',
      ACCOUNT_CHANGED: '其他页面已切换账号，请关闭窗口后重新登录或刷新页面。',
      RATE_LIMIT: '操作过于频繁，请 15 分钟后重试。',
      UPLOAD_PENDING: '已有未完成上传，请重试原请求；中断上传最多保留 24 小时。',
      NETWORK: '网络中断，操作结果暂未确认。重试将先核实同一请求，避免重复覆盖。',
      SERVER_ERROR: '服务处理失败。请重试核实结果；仍失败时联系站点维护者。',
      FORBIDDEN: '请求来源校验失败，请在本站重新操作。'
    }
  },
  en: {
    login: 'Log in',
    register: 'Register',
    logout: 'Log out',
    username: 'Username',
    password: 'Password',
    confirmPassword: 'Confirm password',
    cancel: 'Cancel',
    confirm: 'Confirm',
    working: 'Working…',
    account: 'Account',
    credentials:
      'Username: 4–32 letters, digits or underscores, case-insensitive. Password: 6–128 characters, case-sensitive.',
    success: 'Operation completed.',
    loginSuccess: 'Logged in successfully',
    registerSuccess: 'Registered successfully',
    retry: 'Check result and retry',
    refresh: 'Refresh preview',
    errors: {
      CREDENTIAL_FORMAT: 'Invalid username or password format.',
      PASSWORD_MISMATCH: 'The passwords do not match.',
      USERNAME_TAKEN: 'This username is already taken.',
      CREDENTIALS: 'Incorrect username or password.',
      LOGIN_REQUIRED: 'Please log in again.',
      ACCOUNT_CHANGED:
        'Another tab changed accounts. Close this dialog and log in again or refresh the page.',
      RATE_LIMIT: 'Too many attempts. Try again in 15 minutes.',
      UPLOAD_PENDING:
        'Unfinished uploads exist. Retry the original request; abandoned uploads are retained for up to 24 hours.',
      NETWORK:
        'Connection lost; the result is not confirmed. Retry checks the same request before writing again.',
      SERVER_ERROR:
        'The service could not finish. Retry to check the result; contact the site maintainer if it persists.',
      FORBIDDEN: 'Request origin check failed. Please try again on this site.'
    }
  }
}
