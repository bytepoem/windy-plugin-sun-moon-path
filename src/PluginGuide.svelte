<script lang="ts">
    import CelestialIcon from './CelestialIcon.svelte';
    import { translations, type UiLanguage } from './pluginTranslations';
    import {
        formatDistanceKm, formatPrecipitationMm, formatTemperatureC, formatVisibilityKm,
        formatWindThreshold, windThresholdUnit, type UnitPreferences, type DistanceUnit,
    } from './unitPreferences';

    export let uiLanguage: UiLanguage;
    export let units: UnitPreferences;
    export let showExtendedDistanceMarker: boolean;

    const OPEN_METEO_URL = 'https://open-meteo.com/';
    const CAMS_URL = 'https://atmosphere.copernicus.eu/';
    const formatDistanceLabel = (distanceKm: number, unit: DistanceUnit): string =>
        `${formatDistanceKm(distanceKm, unit)} ${unit}`;
    $: text = translations[uiLanguage];
    $: windWarningThresholdLabel = formatWindThreshold(4.5, units.wind);
    $: windDangerThresholdLabel = formatWindThreshold(9, units.wind);
    $: windLegendUnit = windThresholdUnit(units.wind);
    $: temperatureLegendValues = [0, 5, 12, 18, 24, 30, 36, 38]
        .map(value => formatTemperatureC(value, units.temperature));
    $: dewPointLegendValues = [33, 34, 35, 36]
        .map(value => formatTemperatureC(value, units.temperature));
    $: precipitationLegendValues = [1, 2.5]
        .map(value => formatPrecipitationMm(value, units.precipitation));
    $: visibilityLegendValues = [0.8, 1.5, 3.5, 7, 12]
        .map(value => formatVisibilityKm(value, units.distance));

</script>

<section class="module-about module-guide" aria-label={text.guideHeading}>
    <p>{uiLanguage === 'zh'
        ? '首次使用且尚未保存语言时，会显示双语语言选择弹窗，默认选中中文；确认后保存，之后可在设置中修改。'
        : 'On your first visit without a saved language, a bilingual language dialog opens with Chinese selected by default. Confirm to save your choice; you can change it later in Settings.'}</p>
    <p>{uiLanguage === 'zh'
        ? '主导航的下拉菜单可切换「云层遮挡」与「彩虹」。偏好设置和使用说明统一位于「设置」，中英文切换位于设置顶部右侧。顶部收藏按钮显示图标和收藏数量。云图、模型和云层模式位于同一行，高度来源及对应子设置位于下一行。'
        : 'The navigation dropdown switches between Clouds and Rainbow. Preferences and this guide are under Settings, with the language switch at the top right. The top favorites button shows its icon and count. Cloud map, model and layer mode share a row; height source and its options follow below, wrapping when space is limited.'}</p>
    <p>{uiLanguage === 'zh'
        ? '彩虹：选择日虹或月虹，调整当地时间，查看主虹／副虹的顶部高度与地平线交点方位。支持双彩虹、完整圆圈；地图为天空俯视投影，0° 圈为水平地平线，高度刻度并非等距，不表示真实距离。完整圆圈的上下半球方向可能重叠，用实线与虚线区分。所选光源在地平线下时隐藏虹弧和虹弧数据。方位线与标记跟随所选日虹／月虹光源和规划时间，光源在地平线下时使用虚线与向下标记。移动端收起时保留图层，进入设置、关于或天气保留此前图层与规划时间；切换地图规划功能或关闭插件后清除。需另行判断水滴、光照、地形和月光亮度。'
        : 'Rainbow: choose Sun or Moon and adjust local time to see bow-top altitudes and horizon-crossing bearings. Double and full-circle modes are available. The map is a top-down sky projection; the 0° ring is the horizon and altitude rings are not evenly spaced. It is not a distance map. In full-circle mode, above/below-horizon directions may overlap and use solid/dashed arcs. Bows and bow readouts are hidden when the selected source is below the horizon. The bearing and marker follow the selected Sun or Moon at planning time; a below-horizon source uses a dashed bearing and downward indicator. Collapsing on mobile keeps the overlay; Settings, About and Weather keep the preceding overlay and planning time; switching map-planning features or closing removes it. Droplets, illumination, terrain and lunar brightness need separate assessment.'}</p>
    <p>{uiLanguage === 'zh'
        ? '七彩虹弧的显示宽度不代表实际角宽。彩色同心圆为反太阳点／反月亮点，方位与光源相差 180°、高度相反，可能位于地平线下；光源在地平线下时隐藏此标记。图标大小固定，不表示佛光大小或出现预报。'
        : 'Rainbow ribbon width is display styling, not actual angular width. The coloured target marks the antisolar/antilunar direction, 180° opposite in azimuth with negated altitude, which may lie below the horizon. It is hidden when the source is below the horizon. The fixed icon size does not model or predict a glory.'}</p>
    <p>{uiLanguage === 'zh'
        ? '主虹条件：点击「评估当前时刻」，按主虹左、中、右方向和三个模型网格尺度距离读取 Open-Meteo 的小时液态降水与直射光，模型跟随天气表，数据源独立。显示雨光等级、小时区间及可展开的依据，可信度固定为低，不是出现概率。小时雨量 ≥0.1 mm、平均直射法向辐射 ≥120 W/m² 仅为未校准的参考，不能证明雨滴同时受光。缺失或超出预报范围显示数据不足；无降水信号不排除未采样区域的彩虹。未检查三维云层，不评估月虹及地平线下弧段。换地点、时间、模型或离地高度清空旧评估，关闭面板取消全部请求。'
        : 'Primary bow conditions: select Assess selected time to sample Open-Meteo hourly liquid rain and direct light along three bow bearings at three model-scaled distances. The model follows the weather table; the source is independent. Rain/light grades, the hour interval and expandable evidence carry low confidence, never an occurrence probability. Rain ≥0.1 mm and mean DNI ≥120 W/m² are uncalibrated references, not proof of simultaneous illumination. Missing or out-of-range data remain unavailable; no rain signal does not rule out rainbows elsewhere. 3D clouds, moonbows and below-horizon arcs are not assessed. Location, time, model or camera-height changes clear old evidence; closing cancels all requests.'}</p>
    <p>{uiLanguage === 'zh'
        ? '视线风险独立于雨光等级。地形使用 Open-Meteo / Copernicus DEM GLO-90，在主虹 7 个方向的 100 m–30 km 内各取 16 点，计入地球曲率；离地高度默认 2 m。山体高于虹弧时提示潜在遮挡，但雨滴可能在山前；不判断雨滴是否处于山影，也可能漏掉采样间山脊或近处建筑、树木。能见度采样机位、候选雨区和中间点，显示雨量区间末端的预报时次及沿途最低值，<5 km 为经验风险提示。近地面能见度不代表高空视线，不与雨区距离直接比较。缺测保留未知，单项失败不抹除其他结果。'
        : 'Sightline risks are separate from the rain/light grade. Terrain uses Open-Meteo / Copernicus DEM GLO-90 at 16 distances from 100 m to 30 km in seven bow directions, with Earth curvature and a default camera height of 2 m. Terrain above the bow indicates potential obstruction, but droplets may lie in front of hills. Shadows on rain are not tested; ridges between samples, nearby buildings and trees may be missed. Visibility samples the observer, candidate rain locations and intermediate points, showing the forecast time at the rainfall interval end and each route minimum. Below 5 km is a screening warning. Surface visibility does not describe elevated sightlines and is not compared directly with rain distance. Missing evidence remains unknown; one failed branch does not discard other results.'}</p>
    <p>{uiLanguage === 'zh'
        ? '「云层遮挡／彩虹」下拉菜单会记住上次选择，刷新后恢复对应 Tab 名称和功能。点击箭头只展开菜单，选择功能后才切换 Tab。'
        : 'The Clouds/Rainbow dropdown remembers the last selected function and restores its tab label after a refresh. The arrow only opens the menu; choosing a function switches the tab.'}</p>
    <p>{text.aboutDescription}</p>
    <p>{uiLanguage === 'zh'
        ? '拖动 Windy 自带时间轴会同步规划日期、当地时间及当前规划图形，包括事件天空盘、彩虹和云层视线；跨天时重新计算升落事件。标有 now 的日月长线仍表示真实当前时刻，不随时间轴变化。'
        : 'Moving the Windy timeline updates the planning date, local clock and active planning geometry: the Events sky chart, rainbow and cloud sightlines. Crossing midnight recalculates events. Sun/Moon bearings labelled now remain tied to the real current instant.'}</p>
    <p>{uiLanguage === 'zh'
        ? '事件页的实时太阳长线为金色实线，实时月亮长线为浅蓝虚线，均带深色描边；末端仅显示日月图标和小号 now，无背景框。它们每 5 秒按当前时刻刷新，不跟随时间条或观测日期；末端只是方位参考，不是天体所在的地理位置。云层视线跟随规划时间，不标为实时。'
        : 'In Events, the live Sun bearing is solid gold and the live Moon bearing is dashed light blue. Both have dark outlines; endpoints show only body icons and small now labels without background boxes. They refresh from the current instant every five seconds, independently of the planning slider or date. Endpoints are bearing references, not celestial geographic locations. Cloud sightlines follow planning time and are not labelled now.'}</p>
    <p>{uiLanguage === 'zh'
        ? '日期旁的时间输入和滑条由事件、云层遮挡、彩虹共用，下方为升落按钮；切换 Tab 或收起面板仍保留时间条与所选时间。点击升落按钮或事件栏的具体时刻可跳转；拖动或输入时间会取消升落高亮，但保留原有长线。拖动时本地预览，结束后按云层设置同步 Windy。更换日期或地点时，手动时间按新日期与当地时区解释，事件时间重新计算；“全部”使用所选日期的当前当地钟点。'
        : 'The time input and slider beside the date are shared by Events, Clouds and Rainbow, with rise/set buttons below. Switching tabs or collapsing the panel preserves the control and time. Click a rise/set shortcut or an event time to jump; editing the clock clears event highlighting but keeps the existing long bearings. Dragging previews locally; releasing synchronizes Windy according to cloud settings. On date/location changes, manual clocks use the new local date and time zone, while event times are recalculated. All uses the current local clock on the selected date.'}</p>
    <p>{uiLanguage === 'zh'
        ? '事件页天空盘跟随共用时间，盘顶标注对应时刻；原有实时日月长线仍表示现在。北上东右，圆周为地平线、圆心为天顶；银河带展示走向与拱形，虚线及向下箭头表示地平线下。天空盘不是距离图，银河带宽仅为示意，不保证可见；切换到云距／彩虹或关闭插件会移除。'
        : 'The Events sky chart follows the shared time labelled above the chart; live Sun/Moon long bearings still mean now. North is up and east is right; the rim is the horizon and the centre is the zenith. The galactic band shows orientation and arch shape; dashes and downward arrows indicate below-horizon directions. This is not a distance map; band width is illustrative and does not guarantee visibility. Switching to Clouds/Rainbow or closing removes the chart.'}</p>
    <p>{uiLanguage === 'zh'
        ? '刷新或重新打开插件时，日期和时间回到当前时刻，按所选地点的时区显示；点击时间旁的“现在”也可一步返回。只在打开或点击时取当前时刻，不持续走时；手动选择后，切换 Tab 或调整参数不会重置时间。规划时间不跨次保存，彩虹的日虹／月虹、双彩虹、完整圆圈选项仍保存在当前浏览器。'
        : 'Refreshing or reopening starts at the current date and time in the selected location’s time zone. Click Now beside the time to return in one step. This captures the instant once rather than running a live clock; switching tabs or adjusting options preserves your selected time. Planning time is not saved between visits. Rainbow Sun/Moon, Double and Full circle options are still saved in this browser.'}</p>
    <p>{uiLanguage === 'zh'
        ? '顶部银心升落按钮保持当前 Tab；在事件页显示银心升落时刻及前后 30 分钟的三条绿色方位线，地平线以下的线仅供方向参考，不代表可见。当天无对应事件时按钮不可用。云层规划中，使用顶部日月与银心事件按钮跳到对应升落时刻；事件页时间栏以图标显示日月和银心升落时刻；“全部”仅用于日月事件总览。手动调整时间后顶部取消升落高亮。移动端收起窗口仍保留云层参考线，展开后保留原来的规划时间；进入设置、关于或天气保留云层参考线和规划时间，切换到其他地图规划功能或关闭插件会清除云层参考线。'
        : 'The top galactic centre rise/set buttons keep the current tab. In Events, three green bearings show the crossing and 30 minutes before and after it; below-horizon bearings are direction references, not visibility claims. Unavailable events are disabled. In cloud planning, the top Sun, Moon and galactic centre buttons select the rise/set event and time. The Events time strip uses icons for Sun, Moon and galactic centre crossings; All is only available for the Sun/Moon overview. Manual time clears the top rise/set highlight. Collapsing the mobile panel keeps cloud reference lines and preserves the planning time on expansion. Settings, About and Weather keep cloud reference lines and planning time; switching map-planning features or closing the plugin removes cloud reference lines.'}</p>
    <p>{uiLanguage === 'zh'
        ? '查看今天时，事件时间栏用柔和背景色突出下一个事件，倒计时对应同一事件。它们跟随真实当前时刻，不随规划时间变化；其他日期不显示实时标记。'
        : 'For today, a subtle background highlights the next event; the countdown refers to that same event. These follow the real current instant, independently of planning time. Other dates do not show a live marker.'}</p>
    <p>{text.supportGuideHint}</p>
    <p>{uiLanguage === 'zh'
        ? '使用统计：仅在 Windy 的分析统计授权允许时，百度统计记录插件打开的基础访问数据，PostHog 记录打开、导航切换和前台停留事件。关闭插件或撤回授权后停止采集。埋点不包含坐标、收藏内容或账号；百度可能使用 Cookie 并接收浏览器信息，两家服务均会接收网络请求的 IP。PostHog 仅使用当前授权会话内的随机标识。'
        : 'Usage statistics: when Windy permits analytics, Baidu Tongji measures basic visits and PostHog receives opening, tab selection and foreground-time events. Collection stops on close or consent withdrawal. Events exclude coordinates, favorites and account details. Baidu may use cookies and receive browser information; both services receive request IP addresses. PostHog uses only a random identifier for the current consented session.'}</p>

    <section class="feature-guide" aria-labelledby="feature-guide-heading">
        <h3 id="feature-guide-heading">{text.featureGuideHeading}</h3>
        <section class="button-hints" aria-labelledby="button-hints-heading">
            <h4 id="button-hints-heading">{text.buttonHintsHeading}</h4>
            <p>{text.buttonHintsDescription}</p>
        </section>
        <dl>
            <div>
                <dt>{text.featureGuide.coordinates.title}</dt>
                <dd>{text.featureGuide.coordinates.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.mapControls.title}</dt>
                <dd>{text.featureGuide.mapControls.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.cloudPlanning.title}</dt>
                <dd>{text.featureGuide.cloudPlanning.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.weatherSources.title}</dt>
                <dd>{text.featureGuide.weatherSources.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.units.title}</dt>
                <dd>{text.featureGuide.units.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.radarOverlay.title}</dt>
                <dd>{text.featureGuide.radarOverlay.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.observationEvidence.title}</dt>
                <dd>{text.featureGuide.observationEvidence.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.favorites.title}</dt>
                <dd>{text.featureGuide.favorites.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.comparison.title}</dt>
                <dd>{text.featureGuide.comparison.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.mobileMode.title}</dt>
                <dd>{text.featureGuide.mobileMode.description}</dd>
            </div>
        </dl>
    </section>

    <div class="sun-path-legend sun-path-legend--module" aria-label={text.mapLegendLabel}>
        <div class="sun-path-legend__items">
            <span class="legend-item">
                <span class="legend-dot legend-dot--origin" aria-hidden="true"></span>
                {text.legend.origin}
            </span>
            <span class="legend-item">
                <span class="legend-dot legend-dot--inner" aria-hidden="true"></span>
                {formatDistanceLabel(200, units.distance)}
            </span>
            <span class="legend-item">
                <span class="legend-dot legend-dot--outer" aria-hidden="true"></span>
                {formatDistanceLabel(400, units.distance)}
            </span>
            {#if showExtendedDistanceMarker}
                <span class="legend-item">
                    <span class="legend-dot legend-dot--extended" aria-hidden="true"></span>
                    {formatDistanceLabel(600, units.distance)}
                </span>
            {/if}
        </div>
        <div class="sun-path-legend__items sun-path-legend__items--lines">
            <span class="legend-item">
                <span class="legend-line legend-line--before" aria-hidden="true"></span>
                {text.legend.sunBefore}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--event" aria-hidden="true"></span>
                {text.legend.sunEvent}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--after" aria-hidden="true"></span>
                {text.legend.sunAfter}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--moon-before" aria-hidden="true"></span>
                {text.legend.moonBefore}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--moon-event" aria-hidden="true"></span>
                {text.legend.moonEvent}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--moon-after" aria-hidden="true"></span>
                {text.legend.moonAfter}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--current" aria-hidden="true"></span>
                {text.legend.currentSun}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--moon" aria-hidden="true"></span>
                {text.legend.currentMoon}
            </span>
        </div>
    </div>

    <section class="settings-guide" aria-labelledby="settings-guide-heading">
        <h3 id="settings-guide-heading">{text.settingsGuideHeading}</h3>
        <dl>
            {#if uiLanguage === 'zh'}
                <div>
                    <dt>{text.locationApiKeyLabel}</dt>
                    <dd>{text.locationApiKeyDescription}</dd>
                </div>
            {/if}
            <div>
                <dt>{text.lineOpacityLabel}</dt>
                <dd>{text.lineOpacityDescription}</dd>
            </div>
            <div>
                <dt>{text.show600Label(formatDistanceLabel(600, units.distance))}</dt>
                <dd>{text.show600Description(formatDistanceLabel(600, units.distance))}</dd>
            </div>
        </dl>
    </section>

    <div class="weather-legend" aria-label={text.weatherLegend.heading}>
        <h3>{text.weatherLegend.heading}</h3>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.cloud}</h4>
            <div class="weather-legend__scale weather-legend__scale--cloud">
                {#each [25, 50, 75, 100] as value}
                    <span class="weather-legend__cloud-sample">
                        <span class="weather-legend__cloud-box" style={`--legend-cloud: ${value}%`} aria-hidden="true"></span>
                        <small>{value}%</small>
                    </span>
                {/each}
            </div>
            <p>{text.weatherLegend.cloudDescription}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.temperature}</h4>
            <div class="weather-legend__scale weather-legend__scale--temperature">
                <span class="weather-legend__swatch tone-freezing">&lt;{temperatureLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-cool">{temperatureLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-cold">{temperatureLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-mild">{temperatureLegendValues[3]}</span>
                <span class="weather-legend__swatch tone-good">{temperatureLegendValues[4]}</span>
                <span class="weather-legend__swatch tone-warning">{temperatureLegendValues[5]}</span>
                <span class="weather-legend__swatch tone-orange">{temperatureLegendValues[6]}</span>
                <span class="weather-legend__swatch tone-danger">≥{temperatureLegendValues[7]}</span>
            </div>
            <p>{text.weatherLegend.temperatureDescription(units.temperature)}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.dewPoint}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">≤{dewPointLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-warning">{dewPointLegendValues[1]}–{dewPointLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-danger">≥{dewPointLegendValues[3]}</span>
            </div>
            <p>{text.weatherLegend.dewPointDescription(units.temperature)}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.humidity}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">&lt;60%</span>
                <span class="weather-legend__swatch tone-warning">60–74%</span>
                <span class="weather-legend__swatch tone-orange">75–84%</span>
                <span class="weather-legend__swatch tone-danger">≥85%</span>
            </div>
            <p>{text.weatherLegend.humidityDescription}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.precipitation}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-warning">&gt;0–&lt;{precipitationLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-orange">{precipitationLegendValues[0]}–{precipitationLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-danger">&gt;{precipitationLegendValues[1]}</span>
            </div>
            <p>{text.weatherLegend.precipitationDescription(
                precipitationLegendValues[0],
                precipitationLegendValues[1],
                units.precipitation,
            )}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.windSpeed}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">≤{windWarningThresholdLabel}</span>
                <span class="weather-legend__swatch tone-warning">&gt;{windWarningThresholdLabel}–{windDangerThresholdLabel}</span>
                <span class="weather-legend__swatch tone-danger">&gt;{windDangerThresholdLabel}</span>
            </div>
            <p>{text.weatherLegend.windSpeedDescription(
                windWarningThresholdLabel,
                windDangerThresholdLabel,
                windLegendUnit,
                units.wind === 'bft',
            )}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.windDirection}</h4>
            <div class="weather-legend__direction-row">
                <svg class="weather-legend__wind-arrow" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2 18 20 12 16 6 20Z"></path>
                </svg>
                <p>{text.weatherLegend.windDirectionDescription}</p>
            </div>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.visibility}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-danger">{visibilityLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-orange">{visibilityLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-warning">{visibilityLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-mild">{visibilityLegendValues[3]}</span>
                <span class="weather-legend__swatch tone-good">{visibilityLegendValues[4]}</span>
            </div>
            <p>{text.weatherLegend.visibilityDescription(units.distance)}</p>
            <p class="weather-legend__sources">
                <a href={OPEN_METEO_URL} target="_blank" rel="noreferrer">Open-Meteo</a>
            </p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.aerosolAod}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">0.05</span>
                <span class="weather-legend__swatch tone-warning">0.15</span>
                <span class="weather-legend__swatch tone-orange">0.30</span>
                <span class="weather-legend__swatch tone-danger">0.50</span>
            </div>
            <p>{text.weatherLegend.aerosolAodDescription}</p>
            <p class="weather-legend__sources">
                <a href={OPEN_METEO_URL} target="_blank" rel="noreferrer">Open-Meteo</a>
                <span aria-hidden="true"> · </span>
                <a href={CAMS_URL} target="_blank" rel="noreferrer">CAMS</a>
            </p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.celestialEvents}</h4>
            <div class="weather-legend__celestial-row">
                <span class="weather-legend__celestial-sample">
                    <CelestialIcon body="moon" size={15} label={text.moon} />
                    <span>↑ 05:30</span>
                </span>
                <span class="weather-legend__celestial-sample">
                    <CelestialIcon body="sun" size={15} label={text.sun} />
                    <span>↓ 18:45</span>
                </span>
            </div>
            <p>{text.weatherLegend.celestialEventsDescription}</p>
        </section>
    </div>
</section>

<style lang="less">

    :global(.sun-path-panel.mobile_ui) .module-about {
        padding: 6px 10px 10px;
    }

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted);
        white-space: nowrap;
    }

    .legend-dot {
        width: 9px;
        height: 9px;
        border: 1px solid rgba(255, 255, 255, 0.58);
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
    }

    .legend-dot--origin {
        width: 11px;
        height: 11px;
        background: rgba(117, 83, 242, 0.62);
    }

    .legend-dot--inner {
        background: rgba(23, 170, 3, 0.58);
    }

    .legend-dot--outer {
        background: rgba(49, 139, 255, 0.58);
    }

    .legend-dot--extended {
        background: rgba(250, 204, 21, 0.55);
    }

    .legend-line {
        display: inline-block;
        width: 24px;
        height: 3px;
        border-radius: 2px;
    }

    .legend-line--before {
        background: #f6b65c;
    }

    .legend-line--event {
        background: #f97316;
    }

    .legend-line--after {
        background: #991b1b;
    }

    .legend-line--moon-before {
        background: #b9a5ff;
        background-image: linear-gradient(90deg, #b9a5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-event {
        background: #5c91ff;
        background-image: linear-gradient(90deg, #5c91ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-after {
        background: #294da8;
        background-image: linear-gradient(90deg, #294da8 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--current {
        background: #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .legend-line--moon {
        background: #8ec5ff;
        background-image: linear-gradient(90deg, #8ec5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    :global(.sun-path-panel:not(.mobile_ui)) .module-about {
        overscroll-behavior-y: auto;
    }

    .module-about {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 12px;
        color: var(--panel-muted);
        background: rgba(0, 0, 0, 0.14);
        font-size: 12px;
    }

    .module-about p {
        margin: 6px 0 0;
    }

    .module-about p:first-child {
        margin-top: 0;
    }

    .module-guide {
        gap: 8px;
        padding: 10px 12px 14px;
    }

    .module-guide > p {
        margin: 0;
        color: var(--panel-muted);
        font-size: 12px;
        line-height: 1.45;
    }

    .feature-guide,
    .settings-guide {
        display: grid;
        gap: 0;
        border-top: 1px solid var(--panel-border);
    }

    .feature-guide h3,
    .feature-guide dl,
    .feature-guide dt,
    .feature-guide dd,
    .settings-guide h3,
    .settings-guide dl,
    .settings-guide dt,
    .settings-guide dd {
        margin: 0;
    }

    .feature-guide h3,
    .settings-guide h3 {
        padding: 10px 0 4px;
        color: var(--panel-text);
        font-size: 13px;
        line-height: 1.2;
    }

    .button-hints {
        display: grid;
        gap: 2px;
        margin: 4px 0 2px;
        padding: 7px 8px;
        border: 1px solid rgba(99, 185, 238, 0.28);
        border-radius: 6px;
        background: rgba(99, 185, 238, 0.08);
    }

    .button-hints h4,
    .button-hints p {
        margin: 0;
    }

    .button-hints h4 {
        color: var(--panel-text);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.25;
    }

    .button-hints p {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.45;
    }

    .feature-guide dl > div,
    .settings-guide dl > div {
        display: grid;
        gap: 4px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .feature-guide dl > div:last-child,
    .settings-guide dl > div:last-child {
        border-bottom: 0;
    }

    .feature-guide dt,
    .settings-guide dt {
        color: var(--panel-text);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.25;
    }

    .feature-guide dd,
    .settings-guide dd {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.45;
    }

    .weather-legend {
        display: grid;
        gap: 0;
        border-top: 1px solid var(--panel-border);
        color: var(--panel-muted);
    }

    .weather-legend h3,
    .weather-legend h4,
    .weather-legend p {
        margin: 0;
    }

    .weather-legend h3 {
        padding: 10px 0 4px;
        color: var(--panel-text);
        font-size: 13px;
        line-height: 1.2;
    }

    .weather-legend__section {
        display: grid;
        gap: 6px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .weather-legend__section:last-child {
        border-bottom: 0;
    }

    .weather-legend__section h4 {
        color: var(--panel-text);
        font-size: 11px;
        line-height: 1.2;
    }

    .weather-legend__section p {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.4;
    }

    .weather-legend__sources {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .weather-legend__sources a {
        color: #8ed0ff;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .weather-legend__celestial-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 28px;
    }

    .weather-legend__celestial-sample {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--panel-text);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
    }

    .weather-legend__scale {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .weather-legend__swatch {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 48px;
        height: 30px;
        padding: 0 6px;
        color: #101624;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    .weather-legend__scale--temperature {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 3px;
    }

    .weather-legend__scale--temperature .weather-legend__swatch {
        min-width: 0;
        padding: 0 2px;
    }

    .weather-legend__scale--cloud {
        align-items: end;
        gap: 12px;
    }

    .weather-legend__cloud-sample {
        display: grid;
        justify-items: center;
        gap: 4px;
    }

    .weather-legend__cloud-sample small {
        color: var(--panel-muted);
        font-size: 9px;
        font-variant-numeric: tabular-nums;
    }

    .weather-legend__cloud-box {
        position: relative;
        display: block;
        width: 34px;
        height: 34px;
        overflow: hidden;
        background: #454545;
    }

    .weather-legend__cloud-box::after {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: var(--legend-cloud);
        background: #f7f7f7;
        content: '';
    }

    .weather-legend .tone-good {
        background: var(--weather-tone-good);
    }

    .weather-legend .tone-warning {
        background: var(--weather-tone-warning);
    }

    .weather-legend .tone-orange {
        background: var(--weather-tone-orange);
    }

    .weather-legend .tone-danger {
        background: var(--weather-tone-danger);
    }

    .weather-legend .tone-cold {
        color: #07164e;
        background: var(--weather-tone-cold);
    }

    .weather-legend .tone-cool {
        background: var(--weather-tone-cool);
    }

    .weather-legend .tone-mild {
        background: var(--weather-tone-mild);
    }

    .weather-legend .tone-freezing {
        background: var(--weather-tone-freezing);
    }

    .weather-legend__direction-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        column-gap: 12px;
    }

    .weather-legend__wind-arrow {
        width: 28px;
        height: 28px;
    }

    .weather-legend__wind-arrow path {
        fill: #eef4fb;
        stroke: rgba(0, 0, 0, 0.28);
        stroke-width: 0.8;
    }

    .sun-path-legend {
        margin-top: 12px;
        padding: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-bg) !important;
        color: var(--panel-text) !important;
    }

    .sun-path-legend--module {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent !important;
    }

    .sun-path-legend__title {
        margin-bottom: 8px;
        color: var(--panel-text) !important;
        font-weight: 600;
    }

    .sun-path-legend__items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .sun-path-legend__items--lines {
        margin-top: 8px;
    }

    .sun-path-legend .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted) !important;
        white-space: nowrap;
    }
</style>
