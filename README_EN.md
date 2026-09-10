# Sun & Moon Path for Windy

[中文](README.md) · **English**

Plan sunrise, sunset, Moon and Milky Way photography on Windy with celestial directions, cloud-distance references, weather and observing conditions at saved locations. Available in Chinese and English on desktop and mobile.

![Plugin interface](src/screenshot.jpg)

## Install and use

Current version: **0.10.4** · [Release notes](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.10.4)

Paste this URL into Windy's external plugin loader, then open **Sun & Moon Path**:

```text
https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.10.4/plugin.min.js
```

1. Click the map or enter WGS84 / GCJ-02 coordinates. Chinese place-name search requires your own Amap, Baidu or Tencent Maps API Key in Settings.
2. Choose a date. Events shows celestial rise/set times, live directions, Moon phase, moonless-night and Milky Way observing windows.
3. In Clouds, select a target and cloud height, then use rise/set shortcuts, local time or the minute slider to plan a shooting time.
4. Check the weather below or compare 2–5 favorite locations for the same date. Mobile supports collapsed, compact and fullscreen modes.

## Features

| Feature | Purpose |
| --- | --- |
| Sun and Moon directions | Rise/set rays sampled 30 minutes before and after each event, live directions, 200 / 400 km reference points and an optional 600 km marker |
| Cloud planning | Six rise/set buttons select Sun, Moon or Galactic Center; single/layered heights from forecast base, cloud-cover profile, temperature/dew-point profile or manual input, mapped sightline intersections and distance envelopes, with a bilingual illustrated guide |
| Weather and observing | Windy / Open-Meteo sources and EC / GFS / ICON models, spanning available data from the past 6 hours to the next 5 days; weather, moonlight and target visibility inform observing windows |
| Favorite comparisons | Reuse Windy favorites, search and sort locations, and compare weather, astronomy, elevation and David Lorenz 2025 light-pollution data |
| Radar overlay | Keyless RainViewer radar over Windy layers, following the host timeline and showing the actual radar frame time |
| Units and help | Follow Windy temperature, wind, precipitation, distance and elevation units; Guide explains usage and limits, while About shows version information, release notes, a [RedNote profile link](https://xhslink.cn/o/rXpBcBK0Qy) and an optional [Afdian support link](https://afdian.com/a/bytepoem) |

## Data limits

- **Cloud distances are geometric references.** Local cloud heights do not describe distant cloud regions. The plugin does not sample weather, terrain, cloud thickness or extinction along the light path, and cannot guarantee visibility or colorful twilight. Time adjustments retain the selected body. The map selector includes satellite observations with an independent timeline; forecast step shares the time-input row. Above-ground cloud base and altitude above sea level are labeled separately. See the [cloud calculation notes in Chinese](docs/cloud-obstruction.md).
- **Cloud height methods.** Cloud-cover detection defaults to ≥ 10%; temperature/dew-point estimates default to a spread ≤ 2°C, with no ice-saturation correction. These are candidate layers, not measured bases. Single view uses the lowest detected layer; a forecast base in layered view fills only its AGL band (low < 2 km, middle 2–6 km, high ≥ 6 km). Missing data never switches methods. Thresholds and manual heights are retained independently.
- **Weather sources differ.** Weather, observing windows and favorite comparisons share the selected source. Cloud base, vertical cloud heights and map clouds always use Windy. Cloud-band definitions may differ; missing values remain empty and failed requests do not switch sources automatically.
- **AOD and visibility.** AOD always comes from CAMS via Open-Meteo. Windy visibility uses an independent Open-Meteo supplement; Open-Meteo mode uses visibility from the selected model.
- **Time and precipitation.** Windy uses native time steps. Open-Meteo hourly data may include server-side interpolation, with precipitation accumulated over the preceding hour. Observing windows show the range of matched precipitation values, not a window total. Past timestamps are model output, not observations.

## Local development

Publishing uses npm **11.12.1**. Node.js must meet dependency requirements (current CI uses 22.23.2).

```sh
npm exec --yes --package=npm@11.12.1 -- npm install
npm test
npm start
```

Open [Windy Developer mode](https://www.windy.com/developer-mode) and load `https://localhost:9999/plugin.js`. Local preview reads bilingual notes from `release-notes/`.

```sh
npm run build
```

Output in `dist/` includes scripts, `plugin.json` and `screenshot.jpg`. Formal release history is read from a complete Netlify snapshot for the minor series and must pass regression tests using the production parser.

## Feedback and license

[Report a problem or suggestion](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues) · [Author: bytepoem](https://github.com/bytepoem) · [MIT License](LICENSE)

Update metadata and complete minor-series notes are hosted on Netlify and synchronized only after a successful Windy upload. See [publishing and recovery](docs/update-hosting.md).
