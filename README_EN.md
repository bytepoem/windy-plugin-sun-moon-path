# Windy Sun & Moon Path

[中文](README.md) · **English**

Windy Sun & Moon Path is a Windy.com external plugin that draws sunrise,
sunset, moonrise, moonset, and live celestial direction lines for a selected
location and date.

The plugin is designed for photographers, hikers, weather watchers, and anyone
who needs to understand where the sun or moon will rise, set, or currently sit
relative to a point on the Windy map.

## Features

- Draws sun and moon event directions on the Windy map.
- Supports sunrise, sunset, moonrise, moonset, or all events at once.
- Shows event-time lines plus 30-minute before and after samples.
- Marks the observer location and 200 km / 400 km direction points.
- Displays current sun and moon azimuth, altitude, moon phase, and illumination.
- Includes an astronomy timeline for dawn, sunrise, moonrise, sunset, dusk, and
  moonset.
- Supports date switching, map single-click location updates, and Windy context
  menu opening.
- Handles unavailable polar-day, polar-night, and missing moon event cases.
- Adds a location forecast table spanning the available past 6 hours through the
  next 5 days, with EC and ICON model switching and EC selected by default.
- Shows weather, combined/high/medium/low cloud cover, temperature, dew point,
  humidity, precipitation, wind speed, and wind direction. Cloud coverage is
  aggregated from the model pressure levels.
- Draws the above-horizon sun and moon curves on the same time axis and labels
  rise/set times for the selected location. These curves are calculated locally
  and are not EC/ICON model fields.
- Uses the time steps returned by Windy without inventing missing hours. Past
  timestamps remain model output rather than historical observations.
- Provides English and Chinese UI text.
- On desktop, keeps **Weather** permanently visible below the original four tabs
  so the astronomy summary and forecast usually fit in one viewport; vertical
  scrolling remains available for shorter windows. Mobile keeps five tabs:
  **Events**, **Weather**, **Guide**, **Settings**, and **About**:
  - **Events** shows event times, directions, and the daily astronomy timeline.
  - **Weather** provides a horizontally scrollable EC or ICON five-day forecast.
  - **Guide** explains the map legend, weather color scales, wind symbol, and data.
  - **Settings** controls the optional 600 km reference point and persists the
    choice in the current browser.
  - **About** links to the repository and Issues, identifies the author and
    version, and provides a GitHub Star entry point.

## Requirements

- Node.js 18 or newer is recommended.
- A Windy account that can load external plugins during development or
  publication.

## Plugin URL

Current formal version: `0.6.0`

Current loadable plugin bundle:

[https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.6.0/plugin.min.js](https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.6.0/plugin.min.js)

Project links:

- GitHub repository: [bytepoem/windy-plugin-sun-moon-path](https://github.com/bytepoem/windy-plugin-sun-moon-path)
- Issues: [report a problem or suggestion](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues)
- Formal release: [0.6.0](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.6.0)
- Author: [bytepoem](https://github.com/bytepoem)

## Development

Install dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

Start the local Windy plugin development server:

```sh
npm start
```

The dev server serves the plugin bundle from `https://localhost:9999/`.

Build the production bundle:

```sh
npm run build
```

The build output is written to `dist/` and includes `plugin.js`,
`plugin.min.js`, source maps, and the plugin `package.json` copy.

## Usage

### Load the plugin

1. Open the Windy entry that supports loading external plugins.
2. Paste the plugin bundle URL above.
3. After the plugin is loaded, open **Sun & Moon Path** from the Windy plugin
   menu or map context menu.

### Use the plugin

After the plugin is open:

1. Select a date.
2. Choose **All**, **Sunrise**, **Sunset**, **Moonrise**, or **Moonset**.
3. Check the map direction lines and the event time, azimuth, and compass
   direction in the panel.
4. Click the map to recalculate directions for another location.
5. On desktop, switch between **Events**, **Guide**, **Settings**, and **About**
   while using the always-visible forecast below. On mobile, switch between all
   five tabs.
6. In the forecast table, select **EC** or **ICON** and scroll from the available past
   6 hours through the next 5 days.

Direction lines start at the selected observer location. Each sampled line uses
the calculated azimuth for that event time and extends through 200 km and
400 km points. When enabled in settings, the line also shows a 600 km point.

## Project Structure

- `src/plugin.svelte` - Windy plugin UI and map integration.
- `src/WeatherTable.svelte` - EC/ICON forecast table, scrolling, and current-time marker.
- `src/WeatherIcon.svelte` - vector weather-condition icons.
- `src/weather.ts` - forecast transformation, cloud aggregation, and time grouping.
- `src/celestialCurve.ts` - sun/moon altitude curves and horizon events aligned with forecast columns.
- `src/solar.ts` - astronomy, azimuth, distance, timeline, and geometry logic.
- `src/overlayOwner.ts` - map overlay ownership across Windy panel remounts.
- `src/pluginConfig.ts` - Windy external plugin metadata.
- `src/*.test.ts` - Vitest coverage for geometry, solar/moon calculations,
  weather transformation, and overlay ownership.
- `docs/` - local development notes and validation checklist.

## License

This project is open source under the MIT License. See [LICENSE](LICENSE).
