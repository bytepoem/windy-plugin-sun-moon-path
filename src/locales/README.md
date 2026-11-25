# 翻译维护

`src/uiLanguage.ts` 注册当前 Windy 设置中的 42 种语言及其原生名称、日期 locale 和能力。默认偏好为 `auto`，从 Windy 的 `usedLang` 读取实际显示语言；单独选择后保留插件偏好，切回“跟随 Windy”恢复跟随。既有手动选择保留，不迁移存储键。所有语言沿用相同的控件顺序与布局，不随语言镜像界面。

中文和英文仍按功能保存在本目录的 TypeScript 字典及 `src/pluginTranslations.ts` 中。`defineMessages` 从中文推断字段与动态参数类型，英文必须匹配；其余 40 种语言保存在 `generated/<language>.json`，使用完整短语的内容 ID。不同业务含义必须使用明确的源文案，例如“New moon”和“Clear API key”，不能把同一个短词同时用于月相、天气和操作。

维护文案时：

1. 组件使用完整语句或完整表头，不拼接已翻译的词组。动态文案用 `localized((t, value: string) => t('Source {{0}}', value))`，参数仅作插值；静态常量插值使用 `localizedText`。
2. 运行 `node scripts/translation-sources.mjs`，将结果通过编辑补丁更新 `source.en.json`。源文修改会生成新 ID；为所有生成词典补齐目标语并移除旧 ID。保留参数占位符、数值含义、单位和品牌名称，结合摄影、天文与气象上下文翻译。
3. 运行 `node scripts/language-resources.mjs`，检查并应用其输出的 `src/languageManifest.ts` 补丁；命令不直接写入该文件。随后运行 `node scripts/language-resources.mjs --check`，验证英文源契约、40 份词典的键与参数，以及 manifest 中的不可变资源版本和哈希。`node scripts/pack-translations.mjs` 是保留的校验入口，仅执行上述 `--check`，不生成词典或补丁。
4. 运行类型检查、lint、测试和生产构建。检查默认跟随、手动覆盖、切回跟随、重新打开、失败重试、连续切换和关闭清理；实际界面验证长文本、动态提示、地图标注和移动布局，确认阿拉伯语、波斯语及希伯来语也保持原控件顺序与布局，并检查上传包体积。

简体中文和英语随插件内置；其他语言是按需下载的独立 JSON 资源，不进入 Windy 上传包。本地 watcher 自动生成 `dist/languages/local/<manifest-version>/`，生产资源可用 `node scripts/language-resources.mjs /tmp/windy-language-site` 在独立临时目录生成，路径为 `languages/release/<manifest-version>/`。日期展示统一采用月在前、日在后的顺序，不通过翻译改变月日顺序。

正式发布由工作流先运行 `scripts/publish-language-resources.py`，保留并原子追加两个镜像的不可变资源目录，再用 `scripts/verify-language-resources.mjs` 检查全部 40 份资源的哈希和 Windy CORS，验证成功后才上传 Windy 插件。旧目录和旧版本哈希保留，回退到旧包仍读取其固定版本。以上发布脚本会写入外部仓库，只能在已获发布授权的流程中执行；本地维护仅生成资源和校验，不能据此自行发布。

审校不能只对照英文短词：先找到所属组件和中英文原文，区分 `Clear height`（清空高度输入）、天气 `Clear`（晴）、`Direct`（搜索结果的直线距离）、`Body`（天体）、`Blue`（蓝调时段）及 GitHub `Star`（加星操作）。高度角与海拔、云底离地高度与云层海拔也必须按上下文区分。固定数值可采用目标语言的小数点与千分组格式，但不能改变数量、单位、公式或判断边界；动态数值文案应避免仅适用于某一个数字的词形。

与 Windy 术语核对时，先确认实际组件或图层标识对应的含义，再参考官方语言资源；不能仅凭英文短词相同批量替换。`heatmaps` 是城市热力图，`ccl` 的菜单入口是热气流，`topoMap` 是户外地图；波浪功率使用 kW/m，不能译成波浪能量。官方译文也可能混淆星期与天体、月相与季度、少云与低云、潮流与海浪，或把晴空湍流中的 `clear` 误译成清除动作；已有准确专业译法应保留。

语言目录通过完整验证后才安装；切换成功后才更新界面与存储。加载失败保留当前界面并提供重试，连续选择只采用最后一次结果，关闭后忽略迟到结果并释放宿主监听器。首次启动的语言资源失败或遇到宿主未知语言时提供独立选择和重试入口。

历史更新日志继续遵循 `zh` / `en` 发布契约，由 `releaseNotesLanguage` 明确选择；不改写历史快照。帮助图也明确选择已有中英文图。新增语言经机器初译和 AI 语言复核；AI 全文语义检查、结构检查及代表语言 UI 验证均不等于真人母语者审校。
