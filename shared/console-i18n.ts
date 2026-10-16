export type ConsoleLocale = 'zh-CN' | 'en';

// 后台文案独立于访客提示页的三语言配置，服务标识和原始错误保持不变。
export const consoleEnglish: Record<string, string> = {
  '用户账号': 'Username', '输入用户账号': 'Enter your username', '请输入用户账号。': 'Please enter your username.',
  '密码': 'Password', '输入管理员密码': 'Enter your password', '请输入密码。': 'Please enter your password.',
  '正在登录…': 'Signing in…', '登录控制台': 'Sign in', '正在检查登录状态…': 'Checking your session…',
  '切换语言': 'Switch language', '提示消息': 'Notifications', '提示消息（{hotkey}）': 'Notifications ({hotkey})',
  '跳转到主内容': 'Skip to main content', '域导航': 'Zone navigation', 'Cloudflare 工作空间': 'Cloudflare workspace',
  '域名管理': 'Domain management', '所有域': 'All zones', '管理员': 'Administrator', '退出登录': 'Sign out',
  '页面导航': 'Page navigation', '服务控制台': 'Service console', '查看域名入口，统一切换服务状态。': 'Manage domains and switch service status.',
  '同步域名': 'Sync domains', '选择域': 'Select zone', '所有域 ({count})': 'All zones ({count})',
  '服务状态概览': 'Service overview', '服务域名': 'Service domains', 'Worker 与代理服务入口': 'Worker and proxied services',
  '正常服务': 'Online', '维护中': 'Maintenance', '已欠费': 'Overdue',
  '关闭维护': 'End maintenance', '开启维护': 'Start maintenance', '设为欠费': 'Mark overdue',
  '正常转发业务请求': 'Forwarding service requests', '展示服务维护提示': 'Showing a maintenance notice', '展示联系管理员续费提示': 'Showing a renewal notice',
  '所有域名': 'All domains', '最近同步 ': 'Last synced ', '尚未同步': 'Not synced yet',
  '搜索域名或 Worker': 'Search domains or Workers', '搜索域名或 Worker…': 'Search domains or Workers…',
  '服务类型': 'Service type', '全部类型': 'All types', '服务器代理': 'Server proxy', '仅 DNS': 'DNS only',
  '服务状态': 'Service status', '全部状态': 'All statuses', '选择当前列表': 'Select current list',
  '已选择 {count} 个': '{count} selected', '清空': 'Clear', '{count} 个域名': '{count} domains',
  '选择 {zone} 当前列表': 'Select current list for {zone}', '选择 {hostname}': 'Select {hostname}',
  '{zone} 域名服务': 'Services for {zone}', '{zone} 域名列表': 'Domains in {zone}',
  '同步失败': 'Sync failed', '选择当前域名': 'Select domains in this zone', '域名': 'Domain',
  '当前状态': 'Current status', '接入状态': 'Routing status', '切换状态': 'Actions',
  '没有符合条件的域名': 'No matching domains', '从你的 Cloudflare 域名开始': 'Start with your Cloudflare domains',
  '调整筛选条件，或同步最新域名配置。': 'Adjust the filters or sync the latest domain configuration.',
  '同步账号中的域，查看 Worker 与服务器代理入口。': 'Sync your zones to view Workers and proxied services.',
  '管理后台入口自动保护': 'Admin entry point is protected',
  '维护时展示静态提示页；恢复后直接访问原服务。路由生效以 Cloudflare 配置传播为准。': 'Maintenance shows a static notice. Restoring service removes the notice route. Changes take effect as Cloudflare propagates the configuration.',
  '关闭维护，恢复服务': 'End maintenance and restore service', '开启服务维护': 'Start service maintenance', '设置服务欠费提示': 'Show an overdue notice',
  '关闭对话框': 'Close dialog', '将对 {count} 个域名设置「{mode}」。': 'Set {count} domains to “{mode}”.',
  '关闭维护后，新请求恢复访问原业务服务。': 'New requests will reach the original service after maintenance ends.',
  '服务正在维护中，请稍后再试。感谢您的理解与耐心等待。': 'The service is under maintenance. Please try again later. Thank you for your patience.',
  '服务已欠费，请及时联系管理员续费。': 'Service payment is overdue. Please contact the administrator to renew.',
  '将移除临时提示路由；通配维护下会添加恢复例外。': 'The temporary notice route will be removed. A restoration exception will be added for wildcard maintenance.',
  '将域名路由切换到对应静态提示页。': 'The domain route will switch to the corresponding static notice.',
  '完成': 'Done', '取消': 'Cancel', '处理中…': 'Processing…', '确认切换': 'Confirm change', '关闭提示': 'Dismiss notification',
  'Worker：': 'Worker:', 'DNS A：': 'DNS A:', 'DNS AAAA：': 'DNS AAAA:', 'DNS CNAME：': 'DNS CNAME:',
  '未取得名称': 'Name unavailable', '同步后显示记录值': 'Sync to load record values',
  '入口已保护': 'Protected entry point', '路由冲突': 'Route conflict', '未开启代理': 'Proxy disabled', '暂不可开启': 'Unavailable',
  '提示页路由': 'Notice route', '原服务直连': 'Original service', '维护覆盖需核查': 'Verify maintenance routing',
  '开启时切换到静态提示页；恢复时移除临时路由，直接访问原服务。': 'Starting maintenance switches to a static notice. Restoring service removes the temporary route.',
  '切换 {hostname} 的服务状态': 'Change service status for {hostname}',
  '操作记录': 'Activity log', '成功': 'Success', '失败': 'Failed', '操作失败': 'Operation failed',
  '保留最近 100 批操作，包含每个域名的处理结果。': 'The latest 100 batches, including the result for each domain.',
  '刷新日志': 'Refresh log', '最近日志': 'Recent activity', '按操作时间从新到旧排列，以批次分页。': 'Newest first, paginated by batch.',
  '每页日志批数': 'Batches per page', '每页 {count} 批': '{count} batches per page',
  '正在查询日志…': 'Loading activity…', '重新查询': 'Retry', '暂无操作记录。': 'No activity yet.', '操作人：': 'Operator: ',
  '操作时间': 'Time', '操作人': 'Operator', '目标状态': 'Target status', '域名与处理结果': 'Domains and results',
  '共 {total} 批操作 · 第 {page} / {pages} 页': '{total} batches · Page {page} of {pages}',
  '尚未加载日志': 'Activity not loaded', '操作日志分页': 'Activity pagination', '首页': 'First', '上一页': 'Previous', '下一页': 'Next', '末页': 'Last',
  '访客提示预览': 'Visitor notice previews', '提示预览语言': 'Preview language', '按访问地区': 'By visitor region',
  '台湾、香港、澳门显示繁体中文，日本显示日文，其他地区显示英文。': 'Traditional Chinese in Taiwan, Hong Kong and Macao; Japanese in Japan; English elsewhere.',
  '服务维护中': 'Service under maintenance', '服务已欠费': 'Service payment overdue',
  '维护期间向访客展示友好提示。': 'Show visitors a friendly notice during maintenance.', '提示访客联系管理员续费。': 'Ask visitors to contact the administrator to renew.',
  '预览': 'Preview', '预览维护提示': 'Preview maintenance notice', '预览欠费提示': 'Preview overdue notice',
  '正在同步 Cloudflare 域名和服务入口…': 'Syncing Cloudflare domains and services…',
  '待核实': 'Needs verification', '待核实 {count} 个': '{count} need verification',
  '部分操作结果待核实，请同步域名后确认。': 'Some results need verification. Sync domains to confirm.',
  '操作结果待核实，请同步域名后确认。': 'This result needs verification. Sync domains to confirm.',
  '部分域名未完成切换，请查看原因后重试。': 'Some domains did not complete the change. Review the reasons and retry.',
  '路由已核实，但未达到目标状态，请同步后重试。': 'The route was verified but did not reach the requested state. Sync and retry.',
  '退出登录未完成，请重试。': 'Sign-out did not complete. Please retry.',
  '检查登录状态失败，请稍后重试。': 'Could not check your session. Please retry.',
  '批量任务标识不正确。': 'Invalid batch identifier.',
  '批量操作未全部完成，请查看处理结果并同步核实。': 'Some batch operations did not finish. Review the results and sync to verify.',
  ' 已完成的结果见下方；其余域名的状态请同步后核实。': ' Completed results are shown below. Sync to verify the remaining domains.',
  '操作失败，请稍后重试。': 'The operation failed. Please try again later.', '日志查询失败，请重试。': 'Could not load activity. Please try again.',
  '请使用 JSON 请求。': 'Please send a JSON request.', '请求内容过大。': 'The request is too large.',
  '请求内容不是有效的 JSON 对象。': 'The request is not a valid JSON object.', '管理员密码尚未正确配置。': 'The administrator password is not configured correctly.',
  '账号或密码格式不正确。': 'Invalid username or password format.', '登录尝试过多，请 15 分钟后重试。': 'Too many sign-in attempts. Try again in 15 minutes.',
  '账号或密码不正确。': 'Incorrect username or password.', '同步失败，保留上次列表；仅可恢复服务': 'Sync failed. Showing the previous list; only service restoration is available.',
  '日志分页参数不正确。': 'Invalid activity pagination parameters.', '请选择 1 到 20 个域名及有效状态。': 'Select 1 to 20 domains and a valid status.',
  '域名参数不正确。': 'Invalid domain parameters.', '请先同步域名列表。': 'Please sync the domain list first.',
  '域名已移除或不在授权范围内，请刷新列表。': 'The domain was removed or is outside the authorized scope. Refresh the list.',
  '管理后台或提示页入口不能切换维护状态。': 'Maintenance cannot be changed for admin or notice entry points.',
  '存在重复路由，请先在 Cloudflare 核查。': 'Duplicate routes exist. Check the Cloudflare configuration first.',
  '路由已被其他配置修改，未覆盖或删除，请在 Cloudflare 核查。': 'Another configuration changed the route. It was left untouched. Check Cloudflare.',
  '存在路由冲突，未修改原配置。': 'A route conflict exists. The original configuration was left untouched.',
  '通配维护存在其他路由冲突，无法安全添加恢复例外。': 'Conflicting wildcard routes prevent adding a restoration exception.',
  'Cloudflare 路由响应不完整，请同步后核查。': 'The Cloudflare route response is incomplete. Sync and verify.',
  '操作失败。': 'Operation failed.', '请先登录。': 'Please sign in first.', '接口不存在。': 'Endpoint not found.',
  '管理后台必须通过 HTTPS 访问。': 'The admin console requires HTTPS.', '请求方法不支持。': 'Request method not supported.',
  '请求来源不正确。': 'Invalid request origin.', '登录已过期，请重新登录。': 'Your session expired. Please sign in again.',
  '操作校验失败，请刷新页面后重试。': 'Request verification failed. Refresh the page and try again.',
  '提示类型不正确。': 'Invalid notice type.', '预览语言不支持。': 'Preview language not supported.',
  '页面不存在。': 'Page not found.', '页面资源暂时不可用。': 'Page assets are temporarily unavailable.',
  '后台暂时不可用，请稍后重试。': 'The admin console is temporarily unavailable. Please try again later.',
  '请先配置 Cloudflare 账号 ID 和 API Token。': 'Configure the Cloudflare account ID and API token first.',
  'Cloudflare API 暂时无法连接，请稍后重试。': 'Cannot connect to the Cloudflare API. Please try again later.',
  'Cloudflare API 返回了无效响应。': 'The Cloudflare API returned an invalid response.', 'Cloudflare 列表响应异常。': 'Invalid Cloudflare list response.',
  '域名列表过大，请缩小 API Token 的授权范围。': 'The domain list is too large. Reduce the API token scope.',
  '后台、维护页和欠费页必须配置三个不同的 Worker 名称。': 'The admin, maintenance and overdue Workers must have different names.',
  'Worker 自定义域名尚未启用': 'The Worker custom domain is not enabled', '原服务入口已移除，仅可移除提示路由': 'The original service was removed; only the notice route can be removed',
  '管理后台或提示页入口，已保护': 'Protected admin or notice entry point', '仅 DNS，未开启 Cloudflare 代理': 'DNS only; Cloudflare proxy is disabled',
  '域尚未在 Cloudflare 激活': 'The zone is not active in Cloudflare', '存在其他 Worker 或绕过规则，需要先处理路由冲突': 'Another Worker or bypass rule conflicts with this route. Resolve the conflict first.',
  '域名读取失败': 'Could not read domains', '服务器响应异常，请稍后重试。': 'Invalid server response. Please try again later.', '请求失败。': 'Request failed.',
};

export function translateConsole(locale: ConsoleLocale, text: string, values: Record<string, string | number> = {}): string {
  let translated = text;
  if (locale === 'en') {
    translated = consoleEnglish[text] ?? text;
    // 动态 API/操作消息只在展示时翻译，不影响状态和路由保护逻辑。
    if (translated === text && !Object.hasOwn(consoleEnglish, text)) {
      const patterns: [RegExp, (...parts: string[]) => string][] = [
        [/^已同步 (\d+) 个域、(\d+) 个域名。$/, (zones, hosts) => `Synced ${zones} zones and ${hosts} domains.`],
        [/^同步完成，(\d+) 个域读取失败，请查看列表中的原因。$/, count => `Sync finished. Could not read ${count} zones. See the reasons in the list.`],
        [/^处理中 (\d+)–(\d+) \/ (\d+)$/, (start, end, total) => `Processing ${start}–${end} / ${total}`],
        [/^操作完成：(\d+) 个成功(?:，(\d+) 个失败，请查看处理结果)?。$/, (success, failed) => `Completed: ${success} succeeded${failed ? `, ${failed} failed. Review the results` : ''}.`],
        [/^操作完成：(\d+) 个成功，(\d+) 个失败，(\d+) 个待核实。$/, (success, failed, uncertain) => `Completed: ${success} succeeded, ${failed} failed, ${uncertain} need verification.`],
        [/^Cloudflare API 请求失败（(\d+)）(?:：(.+)|。)$/, (status, detail) => `Cloudflare API request failed (${status})${detail ? ': ' + detail : '.'}`],
      ];
      for (const [pattern, format] of patterns) {
        const match = text.match(pattern);
        if (match) { translated = format(...match.slice(1)); break; }
      }
      const suffix = ' 已完成的结果见下方；其余域名的状态请同步后核实。';
      if (text.endsWith(suffix)) translated = translateConsole(locale, text.slice(0, -suffix.length)) + consoleEnglish[suffix];
    }
  }
  if (locale === 'en' && values.count === 1 && (text === '{count} 个域名' || text === '将对 {count} 个域名设置「{mode}」。')) translated = translated.replace('domains', 'domain');
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
