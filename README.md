# Sun & Moon Path for Windy

**中文** · [English](README_EN.md)

在 Windy 地图上规划日出、日落、月亮和银河拍摄：查看天体方向、云层距离参考、天气和收藏机位的观测条件。支持中英文、桌面端与移动端。

![插件界面](src/screenshot.jpg)

## 安装与使用

当前版本：**0.10.4** · [更新记录](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.10.4)

将以下地址填入 Windy 的外部插件加载入口，加载后打开 **Sun & Moon Path**：

```text
https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.10.4/plugin.min.js
```

1. 单击地图选点，或输入 WGS84 / GCJ-02 坐标。中文地点搜索需在设置中填写高德、百度或腾讯地图 API Key。
2. 选择日期，在「事件」查看日月升落、实时方位、月相、无月和银河观测时段。
3. 在「云层遮挡」选择目标与云高，通过升落快捷按钮、当地时间或分钟滑条规划拍摄时刻。
4. 查看下方天气，或选择 2–5 个收藏地点比较同一天的观测条件。移动端支持收起、小窗口与全屏。

## 主要功能

| 功能 | 用途 |
| --- | --- |
| 日月方向 | 显示升落前后 30 分钟的方向线、实时日月方向，以及 200 / 400 km 参考点；可启用 600 km 标记 |
| 云层规划 | 通过六个升落按钮选择太阳、月亮或银心；单层／分层均支持 Windy 预报云底、云量剖面、温湿剖面及手动海拔，地图展示视线交点和云距包络，配有中英文图解 |
| 天气与观测 | Windy / Open-Meteo 数据源和 EC / GFS / ICON 模型，覆盖可用的过去 6 小时至未来 5 天，结合天气、月光与目标可见性展示观测时段 |
| 收藏对比 | 复用 Windy 收藏，可搜索、排序，比较天气、天文事件、海拔与 David Lorenz 2025 光污染数据 |
| 雷达叠加 | RainViewer 无需 Key，可叠加到 Windy 图层并跟随宿主时间条，显示实际雷达时次 |
| 单位与说明 | 跟随 Windy 温度、风速、降水、距离及海拔单位；「说明」提供图例与使用边界，「关于」显示版本、更新日志、[小红书关注](https://xhslink.cn/o/rXpBcBK0Qy)及[爱发电自愿打赏入口](https://afdian.com/a/bytepoem) |

## 数据边界

- **云层距离是几何参考。** 当前点云高不代表远方云区；不沿光路采样天气、地形、云厚或消光，不保证目标可见或出现朝晚霞。调整时间时保持所选天体。卫星云图为独立实况对照，不与未来预报时刻同步。云底离地高度与计算海拔分别标注。详见[云层计算说明](docs/cloud-obstruction.md)。
- **云高来源可切换。** 单层默认预报云底，分层默认云量剖面；温湿剖面是候选云层估算，不等同实测。缺测不自动换方法，手动高度与阈值独立保存。具体阈值、分层和高度基准见云层计算说明。
- **天气来源有区别。** 天气表格、观测时段和收藏对比共用所选来源；云底、分层云高及地图云图始终使用 Windy。不同来源的云层划分可能不同，缺测保留空值，请求失败不自动换源。
- **AOD 与能见度。** AOD 始终来自 Open-Meteo 提供的 CAMS 数据；Windy 的能见度由独立 Open-Meteo 数据补充，Open-Meteo 模式则使用所选模型的能见度。
- **时间与降水。** Windy 使用原始时间步长；Open-Meteo 逐小时序列可能含服务端插值，降水为标签前一小时累计量。观测时段显示匹配时次的降水范围，不是窗口累计量；过去时段是模式结果，不是实况。

## 本地开发

发布工作流使用 npm **11.12.1**；Node.js 需满足依赖要求（当前 CI 为 24）。

```sh
npm exec --yes --package=npm@11.12.1 -- npm install
npm test
npm start
```

打开 [Windy Developer mode](https://www.windy.com/developer-mode)，加载 `https://localhost:9999/plugin.js`。本地预览从 `release-notes/` 读取双语日志。

```sh
npm run build
```

产物位于 `dist/`，包括脚本、`plugin.json` 和 `screenshot.jpg`。正式版本与更新日志从 Netlify 读取完整 minor 系列快照，发布时在 Windy 上传成功后自动同步，并通过生产解析器验证。配置与失败恢复见[更新托管说明](docs/update-hosting.md)。

开发维护另见[预报请求与组件职责](docs/refactor-0.11.0.md)。

## 反馈与许可

[提交问题或建议](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues) · [作者 bytepoem](https://github.com/bytepoem) · [MIT License](LICENSE)
