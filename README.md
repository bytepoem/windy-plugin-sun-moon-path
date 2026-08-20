# Windy Sun & Moon Path

**中文** · [English](README_EN.md)

Windy Sun & Moon Path 是一个 Windy.com 外部插件，用于在 Windy 地图上显示指定位置、
指定日期的日出、日落、月升、月落方向线，以及当前太阳和月亮方位。

它适合摄影、户外、观星、天气观察等场景：用户可以在地图上选择一个观察点，插件会计算
日月事件发生时的方位角，并在地图上画出 200 km 和 400 km 方向参考点，帮助判断太阳或
月亮会从哪个方向升起、落下，或者当前位于哪个方向。

## 功能

- 在 Windy 地图上绘制太阳和月亮事件方向线。
- 支持日出、日落、月升、月落，也可以一次显示全部事件。
- 每个事件显示事件前 30 分钟、事件时刻、事件后 30 分钟三条采样方向线。
- 标记观察点，以及每条方向线上距离观察点 200 km 和 400 km 的参考点。
- 显示当前太阳和月亮的方位角、高度角、月相和月亮照明比例。
- 提供当天的黎明、日出、月升、日落、黄昏、月落时间轴。
- 支持切换日期、单击地图重新选择位置、从 Windy 右键菜单打开。
- 对极昼、极夜、当天无月升/月落等情况给出明确状态。
- 提供当前位置从过去 6 小时到未来 5 天的天气模式表格，支持 EC 和 ICON 切换，默认使用 EC。
- 天气表格包含天气、综合云量、高中低云、气温、露点、湿度、降水、风速和风向；云量由模式压力层数据聚合得到。
- 天气表格底部按同一时间轴绘制当前定位的太阳、月亮地平线以上曲线，并标注升起和降落时间；曲线来自本地天文计算，不属于 EC/ICON 模式字段。
- 天气时间步长以 Windy 实际返回结果为准，不补造缺失小时；过去时段是模式结果，不是历史观测。
- 插件界面支持中文和英文。
- 桌面端将 **天气** 表格常驻在原有四个标签下方，尽量在一屏内同时展示天文摘要和天气；窗口高度不足时仍可纵向滚动。移动端保留 **事件**、**天气**、**说明**、**设置**、**关于** 五个标签：
  - **事件**：查看日月事件时间、方向和当天时间轴。
  - **天气**：横向查看 EC 或 ICON 模式的五天天气时间序列。
  - **说明**：查看地图图例、天气色阶、风向符号和数据说明。
  - **设置**：控制是否显示 600 km 参考点，设置会保存在当前浏览器。
  - **关于**：查看仓库、Issues、作者和版本信息，并提供 GitHub Star 入口。

## 环境要求

- 建议使用 Node.js 18 或更新版本。
- 需要可以加载外部插件的 Windy 账号或发布环境。

## 插件链接

当前正式版本：`0.5.1`

当前可加载的插件 bundle：

[https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.1/plugin.min.js](https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.1/plugin.min.js)

项目链接：

- GitHub 仓库：[bytepoem/windy-plugin-sun-moon-path](https://github.com/bytepoem/windy-plugin-sun-moon-path)
- Issues：[提交问题或建议](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues)
- 正式版发布页：[0.5.1](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.5.1)
- 作者：[bytepoem](https://github.com/bytepoem)

## 本地开发

安装依赖：

```sh
npm install
```

运行测试：

```sh
npm test
```

启动本地 Windy 插件开发服务：

```sh
npm start
```

开发服务会通过 `https://localhost:9999/` 提供插件 bundle。

构建生产版本：

```sh
npm run build
```

构建产物会输出到 `dist/`，包括 `plugin.js`、`plugin.min.js`、source map 和插件
`package.json` 副本。

## 使用方式

### 加载插件

1. 打开 Windy 支持外部插件加载的入口。
2. 填入上面的插件 bundle 链接。
3. 加载成功后，在 Windy 插件菜单或地图右键菜单中打开 **Sun & Moon Path**。

### 使用插件

插件打开后：

1. 选择日期。
2. 选择 **All**、**Sunrise**、**Sunset**、**Moonrise** 或 **Moonset**。
3. 查看地图上的方向线和面板中的事件时间、方位角、方向名称。
4. 单击地图上的任意位置，插件会重新计算该观察点的方向线。
5. 桌面端在 **事件**、**说明**、**设置**、**关于** 四个视图之间切换，并直接使用下方常驻天气表格；移动端在五个标签之间切换。
6. 在天气表格中选择 **EC** 或 **ICON**，横向滑动查看过去 6 小时到未来 5 天的模式预报。

方向线从选中的观察点出发，按照对应事件时刻的方位角延伸，并标出 200 km 和 400 km
参考点；开启设置后会额外显示 600 km 参考点。

## 项目结构

- `src/plugin.svelte` - Windy 插件界面和地图集成。
- `src/WeatherTable.svelte` - EC/ICON 天气表格、滚动和当前时间标记。
- `src/WeatherIcon.svelte` - 天气状态矢量图标。
- `src/weather.ts` - 天气时间序列转换、云层聚合和时间分组。
- `src/celestialCurve.ts` - 与天气列对齐的日月高度曲线和地平线事件计算。
- `src/solar.ts` - 日月计算、方位角、距离、时间轴和几何计算逻辑。
- `src/overlayOwner.ts` - 处理 Windy 面板重新挂载时的地图覆盖物归属。
- `src/pluginConfig.ts` - Windy 外部插件元数据。
- `src/*.test.ts` - 几何计算、日月计算、天气转换和覆盖物归属的 Vitest 测试。
- `docs/` - 本地开发记录和验证清单。

## 开源协议

本项目基于 MIT License 开源。详见 [LICENSE](LICENSE)。
