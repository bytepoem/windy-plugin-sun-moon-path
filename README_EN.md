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
- Provides English and Chinese UI text.
- Organizes the panel into four views: **Events**, **Guide**, **Settings**, and
  **About**:
  - **Events** shows event times, directions, and the daily astronomy timeline.
  - **Guide** explains the map legend, colors, and data.
  - **Settings** controls the optional 600 km reference point and persists the
    choice in the current browser.
  - **About** links to the repository and Issues, identifies the author and
    version, and provides a GitHub Star entry point.

## Requirements

- Node.js 18 or newer is recommended.
- A Windy account that can load external plugins during development or
  publication.

## Plugin URL

Current formal version: `0.5.1`

Current loadable plugin bundle:

[https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.1/plugin.min.js](https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/0.5.1/plugin.min.js)

Project links:

- GitHub repository: [bytepoem/windy-plugin-sun-moon-path](https://github.com/bytepoem/windy-plugin-sun-moon-path)
- Issues: [report a problem or suggestion](https://github.com/bytepoem/windy-plugin-sun-moon-path/issues)
- Formal release: [v0.5.1](https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/v0.5.1)
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
5. Switch between **Events**, **Guide**, **Settings**, and **About** to view the
   event information, map guide, 600 km setting, and project links.

Direction lines start at the selected observer location. Each sampled line uses
the calculated azimuth for that event time and extends through 200 km and
400 km points. When enabled in settings, the line also shows a 600 km point.

## Project Structure

- `src/plugin.svelte` - Windy plugin UI and map integration.
- `src/solar.ts` - astronomy, azimuth, distance, timeline, and geometry logic.
- `src/overlayOwner.ts` - map overlay ownership across Windy panel remounts.
- `src/pluginConfig.ts` - Windy external plugin metadata.
- `src/*.test.ts` - Vitest coverage for geometry, solar/moon calculations, and
  overlay ownership.
- `docs/` - local development notes and validation checklist.

## License

This project is open source under the MIT License. See [LICENSE](LICENSE).
