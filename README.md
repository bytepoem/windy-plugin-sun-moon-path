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
- 插件界面支持中文和英文。

## 环境要求

- 建议使用 Node.js 18 或更新版本。
- 需要可以加载外部插件的 Windy 账号或发布环境。

## 插件链接

当前可加载的插件 bundle：

[https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.0/plugin.min.js](https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.0/plugin.min.js)

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
5. 在 **事件** 视图查看当天日月时间轴，在 **说明** 视图查看地图图例和数据说明，在 **设置** 视图控制 600 km 参考点显示。

方向线从选中的观察点出发，按照对应事件时刻的方位角延伸，并标出 200 km 和 400 km
参考点；开启设置后会额外显示 600 km 参考点。

## 项目结构

- `src/plugin.svelte` - Windy 插件界面和地图集成。
- `src/solar.ts` - 日月计算、方位角、距离、时间轴和几何计算逻辑。
- `src/overlayOwner.ts` - 处理 Windy 面板重新挂载时的地图覆盖物归属。
- `src/pluginConfig.ts` - Windy 外部插件元数据。
- `src/*.test.ts` - 几何计算、日月计算和覆盖物归属的 Vitest 测试。
- `docs/` - 本地开发记录和验证清单。

## 开源协议

本项目基于 MIT License 开源。详见 [LICENSE](LICENSE)。
