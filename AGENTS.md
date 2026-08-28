# 项目规则

## Git 提交

- 所有新提交的 message 使用中文；`feat`、`fix`、`docs`、`chore`、`release` 等 Conventional Commits 类型前缀保持英文。

## Windy 插件审核

### 本地 UI 验收授权

- 当用户明确要求实现或修复插件 UI 时，视为同时授权完成与该改动直接相关的本地 Windy UI 验收，无需再次确认。
- 本地验收允许启动和停止当前项目的 `npm start` watcher，并在隔离浏览器中打开 Windy Developer mode；固定入口为 `https://www.windy.com/developer-mode`，不得使用普通插件列表页代替。
- 本地验收允许安装、打开和重新加载当前工作区通过 `https://localhost:9999/plugin.js` 提供的本地插件，以及修改测试日期、Tab 和插件显示模式。
- 本地验收允许获取仅用于开发检查的临时截图和页面状态；验收结束后必须关闭隔离浏览器，并停止本次验收启动的 watcher。
- 该授权仅限当前工作区的本地 bundle 和开发验收，不包含正式发布、生产操作、公开提交、账号设置变更或其他外部写入。

### 生命周期清理

- 所有手工注册的监听器和定时任务都必须在用户关闭插件时通过 `onDestroy` 立即释放，不得延迟到下次挂载时清理。
- `map.on`、`bcast.on`、`singleclick.on`、`addEventListener`、`setInterval`、`setTimeout` 等注册操作，必须使用对应的 `off`、`removeEventListener`、`clearInterval`、`clearTimeout` 成对清理。
- 清理逻辑应同时移除插件创建的地图图层，并中止或失效化仍在进行的异步请求，避免插件关闭后继续修改地图或组件状态。
- 交付前必须检索所有监听器和定时任务注册点，逐项确认其已纳入 `onDestroy` 调用的统一清理流程。

### 插件截图

- 插件必须包含真实功能界面的截图，固定路径为 `src/screenshot.jpg`。
- 发版时如发现 UI 有变化，先向用户索取新截图，不自行截取。
- 截图应在文字、图标和关键数据清晰可辨的前提下尽量压缩体积，以满足 Windy 插件上传限制。
- 发布前必须运行生产构建，并确认截图已复制到构建目录，且生成的 `plugin.json` 中 `screenshot` 字段为 `screenshot.jpg`。
