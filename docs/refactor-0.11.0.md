# 预报请求与组件职责

本文保留 0.11.0 重构形成的模块边界与请求契约；文件名沿用原路径。具体版本与变更记录见 package.json 和 release-notes/。

## 职责

- 天气 provider：统一 Windy / Open-Meteo 来源选择与数据转换，返回标准天气和 Windy 原始预报；不管理 UI、缓存或跨地点并发。
- 预报 controller：拥有天气、大气补充数据和云层请求的身份、取消、结果、重试与合并；每个插件实例独立。
- 主组件：传入地点、模型、来源、时间桶与可见性，显示状态；天文地点上下文和地图交互继续由既有模块负责。
- 收藏对比：复用 provider，保留原有双地点并发限制和 session。
- 偏好模块：保留各存储 key、默认值、归一化及存储失败的会话内行为，不迁移用户数据。

## 状态与时序矩阵

| 入口 | 请求状态与结果 | 校验 |
| --- | --- | --- |
| 首次可见且地点上下文就绪 | idle → loading → ready/empty/error | 未就绪或不可见不发起请求 |
| 相同 key 再次更新 | 保留已加载或失败结果 | 不重复加载，不自动循环重试 |
| 切地点/模型/来源/预报时间桶 | 中止失效请求，清除对应旧结果 | 即使旧请求忽略 abort，晚到结果不得写回 |
| 模型变化 | 天气和云层重载，大气结果按既有 source/location/hour key 复用 | 不额外发大气请求 |
| 显式重试相同 key | 旧请求失效，新请求获得唯一身份 | 旧请求 resolve/reject/finally 不干扰新请求 |
| Open-Meteo 天气 + 云层 Tab | 天气独立加载，云层只读 Windy | 云层失败不污染天气状态 |
| Windy 天气 + 云层 Tab | 云层复用天气原始 payload | 不重复请求 Windy |
| 移动端收起普通详情 | 中止尚未完成的详情请求，已完成结果保留 | 展开可重新加载；云层 Tab 收起时销毁子组件，展开后重建 |
| 地点相同但用户显式重新定位 | 失效现有天气/大气/云层结果，等待上下文 | 不能被旧请求恢复 |
| 销毁或实例替换 | abort 所有请求，停止结果通知 | 不恢复请求，不修改地图、DOM 或组件状态 |

失败按各通道独立显示；重试为显式操作，不新增自动补偿或降级。无需数据库、数据迁移或部署切换；回滚代码即可使用原有偏好和发布快照。

## 验证

通过 provider 测试和受控 Promise 的 controller 测试验证以上时序。偏好模块通过存储行为测试验证。UI 静态测试仅保留布局契约，不用源码字符串证明请求行为。运行全套测试及生产构建，检查清理注册点，基于全部 staged/unstaged/untracked 快照复审。组件拆分还需本地 Windy 验收。

## 实现入口

- [weatherProvider.ts](../src/weatherProvider.ts)：数据来源选择，Windy 原始云层预报与标准天气结果。
- [forecastController.ts](../src/forecastController.ts)：天气、大气、云层三通道；通过 key 识别可复用结果，通过 AbortController 身份区分同 key 重试。
- [plugin.svelte](../src/plugin.svelte)：传递输入并显式接收 update 返回的同步快照，使 loading 状态在同一次响应式更新中显示；异步完成通过回调通知。
- [favoriteComparison.ts](../src/favoriteComparison.ts)：收藏对比会话。
- [forecastController.test.ts](../src/forecastController.test.ts)、[weatherProvider.test.ts](../src/weatherProvider.test.ts)：请求时序与来源行为验证。

加载动画只由请求状态驱动，不新增计时器。销毁是终态：即使底层请求忽略取消，其 resolve、reject 和 finally 也不能恢复状态或发出通知。
