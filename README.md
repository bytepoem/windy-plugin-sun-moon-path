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
- 支持配置用户自己的高德、百度或腾讯地图 API Key，切换搜索提供商并从国内地点联想列表中选择观察点。
- 地址结果按与当前观察点的直线距离排序，并显示城市、区县、直线距离和海拔。
- 自动将高德/腾讯的 GCJ-02 或百度的 BD-09 坐标转换为 Windy 使用的 WGS84 坐标后定位。
- 对极昼、极夜、当天无月升/月落等情况给出明确状态。
- 显示 David Lorenz 2025 光污染图集的 SQM、估算等效 Bortle 等级和理想条件下的观测参考。
- 提供当前位置从过去 6 小时到未来 5 天的天气模式表格，支持 EC、GFS 和 ICON 切换，默认使用 EC。
- 天气表格包含天气、综合云量、高中低云、气温、露点、湿度、AOD 550 nm、能见度、降水、风速和风向；云量由模式压力层数据聚合得到。
- AOD 和能见度无需 API Key，由 Open-Meteo 提供；其中 AOD 数据源为 CAMS，且两项数据不随 EC、GFS 或 ICON 切换。Open-Meteo 的全球 AOD 原生时间分辨率通常为 3 小时、空间分辨率约 45 km，欧洲区域可达到约 11 km 和逐小时。
- 天气表格底部按同一时间轴绘制当前定位的太阳、月亮地平线以上曲线，并标注升起和降落时间；曲线来自本地天文计算，不属于 EC/ICON/GFS 模式字段。
- 天气时间步长以 Windy 实际返回结果为准，不补造缺失小时；过去时段是模式结果，不是历史观测。
- 插件界面支持中文和英文，语言选择会保存在当前浏览器。
- 桌面端将 **天气** 表格常驻在原有四个标签下方，尽量在一屏内同时展示天文摘要和天气；窗口高度不足时仍可纵向滚动。移动端支持方位线模式、小窗口和全屏三种状态：方位线模式保留国内地址搜索、日期与事件控制、地点与实时日月方位、当天事件时间，收藏列表向上展开；小窗口保留 **事件**、**天气**、**说明**、**设置**、**关于** 五个标签，全屏时将天气表格放在事件模块下方；方位线模式和小窗口的选择会保存在当前浏览器：
  - **事件**：查看日月事件时间、方向和当天时间轴。
  - **天气**：横向查看 EC、GFS 或 ICON 模式的五天天气时间序列。
  - **说明**：查看地图图例、天气色阶、风向符号和数据说明。
  - **设置**：填写高德、百度或腾讯地图 API Key，选择是否隐藏国内地址搜索框，并控制方位线透明度和是否显示 600 km 参考点；设置会保存在当前浏览器。
  - **关于**：查看仓库、Issues、作者和版本信息，并提供 GitHub Star 入口。

## 环境要求

- 建议使用 Node.js 18 或更新版本。
- 需要可以加载外部插件的 Windy 账号或发布环境。

## 插件链接

当前正式版本：`0.7.0`

当前可加载的插件 bundle：

[https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.7.0/plugin.min.js](https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.7.0/plugin.min.js)

项目链接：

- GitHub 仓库：[bytepoem/windy-plugin-sun-moon-path](https://github.com/bytepoem/windy-plugin-sun-moon-path)
- Issues：[提交问题或建议](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues)
- 正式版发布页：[0.7.0](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.7.0)
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

1. 如需地址搜索，在 **设置** 中填写并保存高德、百度或腾讯地图对应的 API Key。
2. 中文界面下，在面板顶部选择已配置的搜索提供商并输入国内地点或地址，从按直线距离排序的联想列表中选择结果；列表同时显示城市、区县、直线距离和海拔，地图会定位到该观察点。英文界面不显示地址搜索。
3. 选择日期。
4. 选择 **All**、**Sunrise**、**Sunset**、**Moonrise** 或 **Moonset**。
5. 查看地图上的方向线和面板中的事件时间、方位角、方向名称。
6. 也可以单击地图上的任意位置，插件会重新计算该观察点的方向线。
7. 桌面端在 **事件**、**说明**、**设置**、**关于** 四个视图之间切换，并直接使用下方常驻天气表格；移动端可通过面板顶部按钮收起为方位线模式、恢复小窗口或进入全屏。方位线模式保留搜索、核心控制和两行天文摘要；如不需要搜索，可在 **设置** 中开启 **隐藏国内地址搜索框**。
8. 在天气表格中选择 **EC**、**GFS** 或 **ICON**，横向滑动查看过去 6 小时到未来 5 天的模式预报。

AOD 和能见度行标记为 **OM**，表示数据由 [Open-Meteo](https://open-meteo.com/) 提供；AOD 的底层数据来自 [Copernicus Atmosphere Monitoring Service (CAMS)](https://atmosphere.copernicus.eu/)。

地图 API Key 只保存在当前浏览器的本地存储中。国内搜索结果会从 GCJ-02 或 BD-09 转换为 WGS84，避免观察点在 Windy 地图上发生偏移。

方向线从选中的观察点出发，按照对应事件时刻的方位角延伸，并标出 200 km 和 400 km
参考点；开启设置后会额外显示 600 km 参考点。

## 项目结构

- `src/plugin.svelte` - Windy 插件界面、状态编排和生命周期集成。
- `src/mapOverlayController.ts` - 地图方向线、参考点、实时方向和图层销毁。
- `src/observationPlanner.ts` - 地点上下文缓存、天文事件规划和观测窗口证据聚合。
- `src/LocationSearch.svelte` - 多地图地点联想、搜索结果列表和键盘交互。
- `src/amap.ts` - 高德 Web 服务调用、结果解析和 GCJ-02/WGS84 坐标转换。
- `src/baidu.ts` - 百度 JSAPI 地点搜索和 BD-09/WGS84 坐标转换。
- `src/tencent.ts` - 腾讯地点联想和 GCJ-02/WGS84 坐标转换。
- `src/WeatherTable.svelte` - EC/ICON/GFS 天气表格、滚动和当前时间标记。
- `src/WeatherIcon.svelte` - 天气状态矢量图标。
- `src/weather.ts` - 天气时间序列转换、云层聚合和时间分组。
- `src/openMeteo.ts` - Open-Meteo AOD、能见度请求、解析和时间轴合并。
- `src/lightPollution.ts` - 光污染图集瓦片读取、SQM 和估算观测条件。
- `src/celestialCurve.ts` - 与天气列对齐的日月高度曲线和地平线事件计算。
- `src/solar.ts` - 日月计算、方位角、距离、时间轴和几何计算逻辑。
- `src/overlayOwner.ts` - 处理 Windy 面板重新挂载时的地图覆盖物归属。
- `src/pluginConfig.ts` - Windy 外部插件元数据。
- `src/*.test.ts` - 几何计算、日月计算、天气转换和覆盖物归属的 Vitest 测试。
- `docs/` - 本地开发记录和验证清单。

## 开源协议

本项目基于 MIT License 开源。详见 [LICENSE](LICENSE)。
