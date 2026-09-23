# 插件使用统计

百度统计负责基础访问，PostHog US Cloud 项目 623982 负责全部手动事件。两者共用 Windy 的分析授权，传输和故障相互独立。

## 授权与生命周期

- 仅 `store.get('consent')?.analytics === true` 时采集。缺失或拒绝时不加载百度 SDK、不发 PostHog 请求、不缓存操作、不计时；中途允许不补报此前的打开和操作。
- 打开以一次插件挂载启动的逻辑使用为单位。实例替换及回主页后的立即自动重开延续会话；正常关闭后再打开重新计数。内部重开超过 2 秒视为新一次使用。
- 前台时长表示页面可见且插件打开的停留时间，不等同持续点击操作。隐藏页面或 `pagehide` 时结算并暂停，恢复可见后继续。
- 每 30 秒、Tab 切换、隐藏及正常关闭时发送尚未报告的时间差。重复选择当前 Tab 不增加次数；移动端折叠、展开和全屏导致的程序切换只改变时间归属，不增加用户选择次数。
- 撤回授权立即丢弃未提交数据、清理计时器、销毁百度容器，并中止 PostHog 未完成的请求。撤回前已到达服务端的数据无法追溯撤销。
- 正常关闭允许已提交的最终请求完成，后续回调仅释放传输内部资源，不修改组件。无持久化队列、延迟批处理或失败重试。
- 普通本地构建利用现有 `betaReleaseNotesUrl` 标志禁用统计；开发页面、非 HTTPS、非 `windy.com`/`www.windy.com` 域名也禁用，无需修改构建配置。

## 百度：基础访问

站点 ID 为 `1bc918b521d751eba5d2d965e88caf3b`。每次真实打开只提交一个虚拟 PV，页面路径为 `/plugins/sun-moon-path/usage`，不调用 `_trackEvent`。

百度保留 PV、UV、地域、系统环境等平台根据访问请求生成的基础报表。插件的使用时长以 PostHog 的显式计时事件为准，不能用百度整页平均访问时长替代；UV 也不是准确的人数。

SDK 在专用隐藏 iframe 中运行，不修改 Windy 主页面的 `_hmt`。iframe 使用固定 URL、标题和空来源，脚本请求只携带站点 origin。自动 PV 和自动发送均默认关闭，只有提交打开 PV 的同步调用期间允许发送。

iframe 用于生命周期隔离，是同源文档，不是防御恶意代码的安全沙箱。关闭时移除 iframe，释放 SDK 内部监听器和计时器。统计像素由主页面创建，避免关闭 iframe 时取消刚提交的打开请求；像素不发送 HTTP Referer，关闭时移除全部回调。

加载前只保留一个待发打开。SDK 加载超时（10 秒）、空响应或错误时丢弃它，并停止该传输实例，不影响 PostHog 或插件。

## PostHog：事件

使用官方公开 Capture API：`https://us.i.posthog.com/i/v0/e/`。配置位于 `src/posthogUsageConfig.ts`，项目 token 是官方明确允许放在公开客户端的只写标识，不是个人 API 密钥，不具备查询或管理权限。项目链接：[Activity](https://us.posthog.com/project/623982/activity/explore)。

| 事件 | 属性 | 含义 |
|---|---|---|
| `plugin_open` | 无额外属性 | 真实打开次数 |
| `tab_select` | `tab` | 用户切换主 Tab，包括键盘操作 |
| `foreground_seconds` | `seconds` | 本段新增插件前台时长 |
| `tab_seconds` | `tab`、`seconds` | 本段新增主 Tab 停留时长 |
| `reached_3min` | 无额外属性 | 每次使用前台累计达到 180 秒，最多一次 |

主 Tab 标识为 `events / weather / clouds / settings / about`。当前版本不统计云层或设置中的子页面。每条事件还带 `plugin`、`plugin_version`、`environment`；正式值为 `production`，验收包为 `test`。

不加载 PostHog JS SDK，不启用自动点击采集、页面浏览采集或录屏。每次授权会话生成随机 `distinct_id`，只保留在内存，内部重挂载延续；撤回后重新授权、正常关闭后重新打开均更换。因此 PostHog 的 Unique users 更接近匿名使用会话数，不能当成跨天去重人数。设置 `$process_person_profile=false` 避免创建用户画像，`$geoip_disable=true` 禁用 IP 地理位置补全。

请求省略 Cookie 和 HTTP Referer，使用 keepalive 发送；同时未完成的请求最多 16 个，超出则丢弃，不建补传队列。任一请求失败不会抛入插件业务流程。

### 查看报告

已创建原生仪表盘：[日月摄影插件 · 使用统计](https://us.posthog.com/project/623982/dashboard/2126176)。位于 PostHog 左侧 **Dashboards**，包含打开次数、累计前台时长（秒）、满 3 分钟次数、每日打开趋势、各 Tab 选择次数、各 Tab 停留时长（秒）共 6 个图表。

默认最近 30 天，筛选 `environment=production`，未开启公开分享。正式版本尚未产生数据时，默认视图显示 0 或无数据；临时把顶部 environment 筛选改为 `test` 可查看验收数据，不必保存为默认值。原有 `Your starter dashboard` 保留，因其使用自动页面浏览等事件，不适用于本插件的手动事件。

- Activity → Events 查看事件及属性，测试后用 `environment=production` 筛选真实使用。
- Product analytics → Trends：选择 `plugin_open` 的 Total count 看打开次数。
- `tab_select` 按 `tab` Breakdown 查看主 Tab 的选择次数。
- `foreground_seconds` 对 `seconds` 做 Sum 查看总时长。
- `tab_seconds` 对 `seconds` 做 Sum，并按 `tab` Breakdown 查看各 Tab 时长。
- `reached_3min` 的 Total count 表示达到 3 分钟的使用次数。

不要将分段事件的平均 `seconds` 当成一次打开的平均时长。总时长除以同周期打开次数只能得到近似值，会受跨日使用、中途授权和丢失事件影响。

## 数据边界

不发送 Windy 账号、经纬度、收藏、搜索词和实际地图 URL，不使用持久化的跨会话用户标识。百度可能保存 Cookie 并接收浏览器信息；两家服务都会接收网络请求的 IP。关闭采集不等于清除先前已产生的百度 Cookie。

`usageMetrics.ts` 负责事件和计时，`pluginUsage.ts` 负责授权、生命周期及分流；两个传输模块各自负责网络。更换平台无需改变计时口径。无需数据库迁移；回滚插件版本不会删除两家后台已有记录，运行中的页面需关闭/重新加载插件以切换代码。

## 验证记录

2026-09-23 此前的百度单平台测试确认基础访问入库，但当前免费账户的“事件分析”提示没有权限，并已迁移至分析云，因此改为百度 PV + PostHog 事件。

分流版本的测试包使用百度 `/plugins/sun-moon-path/usage-test` 路径与 PostHog `environment=test`，不改正式源码的开发环境开关。真实 Windy 页面中已验证 PostHog 打开、Tab 切换和时长请求返回 200，Activity 已入库全部五类事件，包括未修改计时器、真实前台累计产生的 `reached_3min`。展开事件核对了 `tab=clouds`、`environment=test` 和 `plugin_version=0.10.4`。

分流首次验收时百度脚本遇到 `ERR_CONNECTION_CLOSED`，PostHog 仍正常发送，验证了传输隔离。同日用户关闭代理后再次实测：`hm.js` 返回 200，只产生一条 `hm.gif`，`et=0`、无 `ep` 事件参数，虚拟路径为 `/plugins/sun-moon-path/usage-test`，响应同样为 200，确认百度分流后仅提交 PV。

自动测试覆盖授权、时间差、可见性、Tab 归属、里程碑、重开去重、两平台分流、匿名标识生命期、加载失败、关闭及撤回、中止请求和清理。

官方参考：[PostHog Capture API](https://posthog.com/docs/api/capture)、[PostHog 聚合](https://posthog.com/docs/product-analytics/trends/aggregations)、[百度虚拟 PV](https://tongji.baidu.com/web/help/article?id=235&type=0)。
