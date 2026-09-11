import type { ObservationEvent as DirectionEvent } from './observationPlanner';
import type { AstronomyInterval } from './solar';
import type { RadarProvider, RadarOverlayStatus } from './radarOverlay';
import type { LocationProvider } from './locationProvider';
import type { UpdateNoteKind } from './pluginUpdate';
import type { TemperatureUnit, PrecipitationUnit, WindUnit, DistanceUnit } from './unitPreferences';

export type UiLanguage = 'zh' | 'en';

/** Shared bilingual copy; presentation modules own rendering, not duplicate translations. */
export const translations: Record<UiLanguage, {
    dateLabel: string;
    eventSelectorLabel: string;
    eventButtonTitles: Record<DirectionEvent, string>;
    languageToggleLabel: string;
    collapsePanelLabel: string;
    expandCompactPanelLabel: string;
    expandPanelLabel: string;
    restorePanelLabel: string;
    fitDirectionLinesLabel: (distance: string) => string;
    restoreSearchZoomLabel: string;
    enableRadarOverlayLabel: string;
    disableRadarOverlayLabel: string;
    panelIntro: string;
    sunMoonPanelLabel: string;
    summaryViewsLabel: string;
    astronomyPanelLabel: (date: string, isToday: boolean) => string;
    currentMoonPhaseLabel: string;
    astronomyEventsLabel: (date: string, isToday: boolean) => string;
    nightObservationWindowsLabel: string;
    observationEvidenceLabel: string;
    observationEvidenceLoading: string;
    observationEvidenceOutsideRange: string;
    observationEvidenceMissing: string;
    observationEvidencePartial: string;
    observationEvidenceUnavailable: string;
    observationMetricLabels: Record<'totalCloudPercent' | 'precipMm' | 'visibilityKm', string>;
    mapLegendLabel: string;
    eventDirectionLinesLabel: (event: string) => string;
    favoriteLocationsLabel: string;
    locationCopyLabel: (location: string) => string;
    favoriteLocationsCountLabel: (count: number) => string;
    saveCurrentLocationFavoriteLabel: string;
    removeCurrentLocationFavoriteLabel: string;
    pinCurrentLocationLabel: string;
    unpinCurrentLocationLabel: string;
    eventTab: string;
    weatherTab: string;
    guideTab: string;
    settingsTab: string;
    aboutTab: string;
    aboutTabUpdateBadge: string;
    aboutTabUpdateLabel: (version: string) => string;
    retry: string;
    eventTimeSuffix: string;
    now: string;
    currentDirectionsLabel: string;
    sun: string;
    moon: string;
    altitude: string;
    locationResolvingLabel: string;
    elevationLabel: string;
    calculating: string;
    noInterval: string;
    intervalUnavailable: string;
    timelineEnded: string;
    timelinePrefix: string;
    timelineStartSuffix: string;
    moonPhaseLoading: string;
    lightPollutionLoadError: string;
    lightPollutionOutOfBounds: string;
    aboutDescription: string;
    guideHeading: string;
    featureGuideHeading: string;
    buttonHintsHeading: string;
    buttonHintsDescription: string;
    featureGuide: Record<
        | 'favorites'
        | 'comparison'
        | 'coordinates'
        | 'observationEvidence'
        | 'mobileMode'
        | 'mapControls'
        | 'radarOverlay'
        | 'cloudPlanning'
        | 'weatherSources'
        | 'units',
        { title: string; description: string }
    >;
    settingsGuideHeading: string;
    settingsHeading: string;
    initialOverlayLabel: string;
    initialOverlayDescription: string;
    keepCurrentOverlayLabel: string;
    radarProviderLabel: string;
    radarProviderDescription: string;
    radarProviderLabels: Record<RadarProvider, string>;
    radarStatusLabels: Record<RadarOverlayStatus, string>;
    rainViewerDescription: string;
    radarOpacityLabel: string;
    radarOpacityDescription: string;
    lineOpacityLabel: string;
    lineOpacityDescription: string;
    show600Label: (distance: string) => string;
    show600Description: (distance: string) => string;
    locationSearchHiddenNotice: string;
    hideLocationSearchLabel: string;
    hideLocationSearchDescription: string;
    locationApiKeyLabel: string;
    locationApiKeyPlaceholder: string;
    locationApiKeyDescription: string;
    locationApiKeySave: string;
    locationApiKeyClear: string;
    locationApiKeySaved: string;
    locationProviderLabels: Record<LocationProvider, string>;
    locationProviderDescriptions: Record<LocationProvider, string>;
    locationProviderApplyLabels: Record<LocationProvider, string>;
    aboutHeading: string;
    aboutAuthorLabel: string;
    aboutVersionLabel: string;
    aboutCurrentVersionDateLabel: string;
    aboutLinksLabel: string;
    aboutGithubLabel: string;
    aboutIssuesLabel: string;
    aboutStarLabel: string;
    aboutStarHint: string;
    aboutSupportLabel: string;
    aboutXiaohongshuLabel: string;
    aboutXiaohongshuHint: string;
    supportGuideHint: string;
    aboutUpdateChecking: string;
    aboutUpdateCurrent: string;
    aboutUpdateAvailable: string;
    aboutBetaAvailable: string;
    aboutUpdateError: string;
    aboutUpdateRetry: string;
    aboutUpdateNotesUnavailable: string;
    aboutUpdateNotesRetry: string;
    aboutUpdateNotesRetrying: string;
    aboutCopyLatestPluginLink: (version: string) => string;
    aboutPluginLinkCopied: (version: string) => string;
    aboutPluginLinkCopyError: string;
    aboutUpdateTypeLabels: Record<UpdateNoteKind, string>;
    weatherLoadError: string;
    atmosphereLoadError: string;
    timeZoneLoadError: string;
    timeZoneInvalidError: string;
    astronomyLoadError: string;
    weatherLegend: Record<
        | 'heading'
        | 'cloud'
        | 'cloudDescription'
        | 'temperature'
        | 'dewPoint'
        | 'humidity'
        | 'humidityDescription'
        | 'precipitation'
        | 'windSpeed'
        | 'windDirection'
        | 'windDirectionDescription'
        | 'visibility'
        | 'aerosolAod'
        | 'aerosolAodDescription'
        | 'celestialEvents'
        | 'celestialEventsDescription',
        string
    > & {
        temperatureDescription: (unit: TemperatureUnit) => string;
        dewPointDescription: (unit: TemperatureUnit) => string;
        precipitationDescription: (
            warning: string,
            danger: string,
            unit: PrecipitationUnit,
        ) => string;
        windSpeedDescription: (
            warning: string,
            danger: string,
            unit: WindUnit,
            beaufort: boolean,
        ) => string;
        visibilityDescription: (unit: DistanceUnit) => string;
    };
    events: Record<DirectionEvent, string>;
    timeline: Record<string, string>;
    intervals: Record<AstronomyInterval['kind'], string>;
    legend: Record<string, string>;
    phases: string[];
}> = {
    zh: {
        dateLabel: '观测日期',
        eventSelectorLabel: '选择日月事件',
        eventButtonTitles: {
            all: '显示全部日月事件方位线',
            sunrise: '只显示日出方位线',
            sunset: '只显示日落方位线',
            moonrise: '只显示月升方位线',
            moonset: '只显示月落方位线',
        },
        languageToggleLabel: '切换到英文',
        collapsePanelLabel: '收起为方位线模式',
        expandCompactPanelLabel: '展开面板',
        expandPanelLabel: '全屏显示',
        restorePanelLabel: '恢复小窗口',
        fitDirectionLinesLabel: distance => `完整显示 ${distance} 方位线`,
        restoreSearchZoomLabel: '回到搜索定位缩放',
        enableRadarOverlayLabel: '开启气象雷达叠加',
        disableRadarOverlayLabel: '关闭气象雷达叠加',
        panelIntro: '日月关键时刻、事件前后 30 分钟方位线和夜间观测时段。',
        sunMoonPanelLabel: '日月信息面板',
        summaryViewsLabel: '日月信息视图',
        astronomyPanelLabel: (date, isToday) => isToday ? '今日天文时段' : `${date}天文时段`,
        currentMoonPhaseLabel: '月相',
        astronomyEventsLabel: (date, isToday) => isToday ? '今日天文事件' : `${date}天文事件`,
        nightObservationWindowsLabel: '夜间观测时段',
        observationEvidenceLabel: '观测时段天气证据',
        observationEvidenceLoading: '正在匹配时段天气…',
        observationEvidenceOutsideRange: '当前五天预报未覆盖该日期',
        observationEvidenceMissing: '该时段暂无预报数据',
        observationEvidencePartial: '当前预报仅覆盖部分时段',
        observationEvidenceUnavailable: '观测天气暂不可用',
        observationMetricLabels: {
            totalCloudPercent: '云量',
            precipMm: '降水',
            visibilityKm: '能见度',
        },
        mapLegendLabel: '地图图例',
        eventDirectionLinesLabel: event => `${event}方向线数据`,
        favoriteLocationsLabel: '收藏地点',
        locationCopyLabel: location => `${location}，复制经纬度`,
        favoriteLocationsCountLabel: count => `打开收藏地点，共 ${count} 个`,
        saveCurrentLocationFavoriteLabel: '收藏当前地点',
        removeCurrentLocationFavoriteLabel: '取消收藏当前地点',
        pinCurrentLocationLabel: '钉住当前地点',
        unpinCurrentLocationLabel: '取消钉住当前地点',
        eventTab: '事件',
        weatherTab: '天气',
        guideTab: '说明',
        settingsTab: '设置',
        aboutTab: '关于',
        aboutTabUpdateBadge: '新',
        aboutTabUpdateLabel: version => `关于，发现新版本 ${version}`,
        retry: '重试',
        eventTimeSuffix: '时间',
        now: '现在',
        currentDirectionsLabel: '当前太阳和月亮方位',
        sun: '太阳',
        moon: '月亮',
        altitude: '∠',
        locationResolvingLabel: '地点解析中…',
        elevationLabel: '海拔',
        calculating: '正在计算…',
        noInterval: '当天无可用时段',
        intervalUnavailable: '暂不可用',
        timelineEnded: '今日天文时段已结束',
        timelinePrefix: '距离',
        timelineStartSuffix: '开始还有',
        moonPhaseLoading: '月相计算中',
        lightPollutionLoadError: '无法取得光污染数据，请稍后重试。',
        lightPollutionOutOfBounds: '该地点超出光污染数据范围（南纬 65° 至北纬 75°）。',
        aboutDescription: '太阳事件线使用实线，月升/月落事件线使用虚线。每个事件包含前 30 分钟、事件时刻和后 30 分钟三个方位。',
        guideHeading: '地图说明',
        featureGuideHeading: '功能说明',
        buttonHintsHeading: '按钮提示',
        buttonHintsDescription: '将鼠标停留在图标或紧凑型按钮上片刻，可查看该按钮的功能说明；按钮的键盘和屏幕阅读器名称保持一致。',
        featureGuide: {
            cloudPlanning: {
                title: '云层遮挡与时间规划',
                description: '通过六个升落按钮选择太阳、月亮或银心及事件时刻，再用当地时间输入或分钟滑条调整时刻；调整时间时保持已选天体。按钮右侧可切换预报云图或卫星云图，预报时次与时间输入、滑条同排。卫星影像使用独立的实况时间，不与未来预报同步。单层和分层均可选择 Windy 预报云底、云量剖面、温湿剖面或手动海拔。单层取最低检出层；分层按离地高度归类，预报云底只填入对应的一层。温湿剖面按可调温度与露点温差估算候选云层，不等同实测云底。表格与地图同步展示遮蔽交点和云距参考；“图解”解释各项距离。当前点云高不代表远处云区，几何参考不包含沿途地形、云厚和消光，不能保证可见或出现朝晚霞。',
            },
            weatherSources: {
                title: '天气数据源与模型',
                description: '天气表格可选 Windy / Open-Meteo 和 EC、GFS、ICON；观测时段与收藏对比同步使用所选来源。云底、分层云高和地图云图始终使用 Windy。AOD 来自 CAMS；Windy 的能见度由 Open-Meteo 补充，Open-Meteo 模式的能见度跟随所选模型。不同来源的云层划分与时间步长可能不同；缺测保留空值，失败可重试，不自动换源。',
            },
            units: {
                title: '显示单位',
                description: '温度、风速、降水、距离和海拔跟随 Windy 单位设置。手动云高输入使用当前海拔单位；离地云底与计算海拔分别标注，不能混用。',
            },

            favorites: {
                title: '收藏地点',
                description: '使用书签按钮收藏或取消收藏当前地点；列表显示距离、海拔和光污染，并支持按距离、收藏时间、海拔或光污染排序。',
            },
            comparison: {
                title: '收藏地点对比',
                description: '从收藏中选择 2–5 个地点，在同一观测日期下对比无月、银河时段、天气、光污染和月相。',
            },
            coordinates: {
                title: '坐标精确定位',
                description: '在搜索下拉中选择 WGS84 或 GCJ-02，分别输入纬度和经度；GCJ-02 会自动转换为 Windy 使用的 WGS84。不用搜索时可点击“隐藏”，在设置中关闭“隐藏地点搜索框”即可恢复。',
            },
            observationEvidence: {
                title: '观测时段证据',
                description: '无月和银河时段同步显示综合云量、降水和能见度，用当前选择的数据源和预报模型补充观测条件依据。',
            },
            mobileMode: {
                title: '移动端方位线模式',
                description: '收起面板后保留搜索、日期、事件、实时方位和当天事件时间，并记住方位线模式或小窗口的选择。',
            },
            mapControls: {
                title: '地图视图按钮',
                description: '标题栏或移动端窗口上方的“−”用于缩放到完整方位线范围，“+”用于恢复搜索地点的详细缩放级别；在云层 Tab 中分别显示全部参考线或聚焦地平线与遮蔽交点。',
            },
            radarOverlay: {
                title: '气象雷达叠加',
                description: '使用标题栏或移动端窗口上方的雷达按钮快速开关 RainViewer；开启后按钮高亮，雷达图层会跟随 Windy 时间条切换，透明度可在设置中调整。',
            },
        },
        settingsGuideHeading: '设置说明',
        settingsHeading: '插件设置',
        initialOverlayLabel: '打开插件时的图层',
        initialOverlayDescription: '选择后立即切换到对应 Windy 图层，并在以后打开插件时继续使用；选择“保持 Windy 当前图层”则不自动切换。设置会保存在当前浏览器。',
        keepCurrentOverlayLabel: '保持 Windy 当前图层',
        radarProviderLabel: '叠加雷达数据',
        radarProviderDescription: '窗口雷达按钮与此设置同步，任一处都可直接开关；开启后会在当前 Windy 图层上叠加 RainViewer，并跟随时间条切换时次。设置仅保存在当前浏览器。',
        radarProviderLabels: {
            none: '不叠加',
            rainviewer: 'RainViewer（无需 Key）',
        },
        radarStatusLabels: {
            disabled: '雷达叠加已关闭',
            loading: '正在加载雷达图层…',
            ready: '雷达图层已加载',
            'out-of-range': '当前 Windy 时间超出第三方雷达可用范围',
            error: '雷达图层加载失败，请检查网络',
        },
        rainViewerDescription: 'RainViewer 使用无需 Key 的公共接口并按中央气象台色阶显示；拖动 Windy 底部时间条可切换可用历史帧。',
        radarOpacityLabel: '雷达图层透明度',
        radarOpacityDescription: '实时调整第三方雷达图层的显示强度。0% 为完全透明，100% 为完全不透明。设置会保存在当前浏览器。',
        lineOpacityLabel: '线条透明度',
        lineOpacityDescription: '调整地图上全部日月方位线、银心视线及云层参考线的显示强度。设置会保存在当前浏览器。',
        show600Label: distance => `显示 ${distance} 点`,
        show600Description: distance => `开启后事件方向线会延伸到 ${distance}，并在该距离增加一个参考点。设置会保存在当前浏览器。`,
        locationSearchHiddenNotice: '地点搜索已隐藏，可在设置中关闭“隐藏地点搜索框”重新显示。',
        hideLocationSearchLabel: '隐藏地点搜索框',
        hideLocationSearchDescription: '开启后不再显示面板顶部的名称和经纬度搜索；已保存的地图 API Key 不会清除。设置会保存在当前浏览器。',
        locationApiKeyLabel: '国内地址搜索 API Key',
        locationApiKeyPlaceholder: '请输入 API Key',
        locationApiKeyDescription: '可配置高德、百度和腾讯，并在搜索框中切换。各 Key 仅保存在当前浏览器。',
        locationApiKeySave: '保存',
        locationApiKeyClear: '清除',
        locationApiKeySaved: '已保存',
        locationProviderLabels: {
            amap: '高德 Web 服务 API Key',
            baidu: '百度 JavaScript API Key',
            tencent: '腾讯 WebService API Key',
        },
        locationProviderDescriptions: {
            amap: '用于高德输入提示，GCJ-02 结果会转换为 Windy 使用的坐标。',
            baidu: '用于百度 JSAPI 4.0 地点检索，BD-09 结果会转换为 Windy 使用的坐标。',
            tencent: '用于腾讯关键词输入提示，GCJ-02 结果会转换为 Windy 使用的坐标。',
        },
        locationProviderApplyLabels: {
            amap: '申请高德 Key',
            baidu: '申请百度 Key',
            tencent: '申请腾讯 Key',
        },
        aboutHeading: '关于插件',
        aboutAuthorLabel: '作者',
        aboutVersionLabel: '版本',
        aboutCurrentVersionDateLabel: '更新日期',
        aboutLinksLabel: '项目链接',
        aboutGithubLabel: 'GitHub',
        aboutIssuesLabel: 'Issues',
        aboutStarLabel: 'Star',
        aboutStarHint: '喜欢这个插件的话，欢迎在 GitHub 给一个 Star。',
        aboutSupportLabel: '喜欢的话，请作者喝杯蜜雪冰城',
        aboutXiaohongshuLabel: '小红书',
        aboutXiaohongshuHint: '在小红书关注我',
        supportGuideHint: '如果插件对你有帮助，可在「关于」通过爱发电自愿打赏，支持后续开发与维护，也可通过小红书入口关注作者。',
        aboutUpdateChecking: '正在检查新版本…',
        aboutUpdateCurrent: '暂无新版本。',
        aboutUpdateAvailable: '发现新版本',
        aboutBetaAvailable: '测试版更新预览',
        aboutUpdateError: '暂时无法检查版本。',
        aboutUpdateRetry: '重试',
        aboutUpdateNotesUnavailable: '版本更新说明暂时无法加载。',
        aboutUpdateNotesRetry: '重新加载更新说明',
        aboutUpdateNotesRetrying: '正在重新加载…',
        aboutCopyLatestPluginLink: version => `复制 ${version} 插件链接`,
        aboutPluginLinkCopied: version => `已复制 ${version} 插件链接`,
        aboutPluginLinkCopyError: '复制失败，请重试',
        aboutUpdateTypeLabels: {
            new: '新增',
            improved: '优化',
            fixed: '修复',
        },
        weatherLoadError: '无法取得天气模式数据，请稍后重试。',
        atmosphereLoadError: '无法取得 Open-Meteo 补充大气数据。',
        timeZoneLoadError: '无法取得观察点时区，请稍后重试。',
        timeZoneInvalidError: 'Windy 返回的观察点时区无效，请稍后重试。',
        astronomyLoadError: '日月方位计算失败，请稍后重试。',
        weatherLegend: {
            heading: '天气图例',
            cloud: '云量',
            cloudDescription: '白色填充越高，云量越多；综合云量表示整体遮挡，高、中、低云表示云层高度。',
            temperature: '气温',
            temperatureDescription: unit => `颜色从低温到高温变化，数字单位为 ${unit}。`,
            dewPoint: '露点',
            dewPointDescription: unit => `绿色不易结露，黄色需要留意，红色容易结露；数字单位为 ${unit}。`,
            humidity: '湿度',
            humidityDescription: '湿度越高，越需要留意结露。',
            precipitation: '降水量',
            precipitationDescription: (warning, danger, unit) =>
                `黄色低于 ${warning} ${unit}，橙色为 ${warning}–${danger} ${unit}，红色高于 ${danger} ${unit}。`,
            windSpeed: '风速',
            windSpeedDescription: (warning, danger, unit, beaufort) =>
                `绿色不超过 ${warning} ${unit}，黄色为高于 ${warning} 至 ${danger} ${unit}，红色高于 ${danger} ${unit}。${beaufort ? 'Windy 使用 bft 时，单元格同时显示 bft/m/s，颜色按精确 m/s 判断。' : ''}`,
            windDirection: '风向',
            windDirectionDescription: '箭头指向风的来向。',
            visibility: '能见度',
            visibilityDescription: unit => `示例数字的单位为 ${unit}。数值越大，远处空气通常越通透。`,
            aerosolAod: '气溶胶 AOD',
            aerosolAodDescription: 'AOD 为 550 nm 全大气柱气溶胶光学厚度；从左到右依次为很低、较低、偏高、较高。数值越低，气溶胶对光的衰减通常越弱，但不能直接换算为能见度。两项由 Open-Meteo 提供，其中 AOD 使用 CAMS 数据，不随 EC、GFS 或 ICON 切换。',
            celestialEvents: '日月升落时间',
            celestialEventsDescription: '太阳和月亮图标用于区分天体；↑ 表示升起，↓ 表示落下，时间为观察点当地时间。',
        },
        events: {
            all: '全部',
            sunrise: '日出',
            sunset: '日落',
            moonrise: '月升',
            moonset: '月落',
        },
        timeline: {
            dawn: '蓝调',
            sunrise: '日出',
            sunset: '日落',
            moonrise: '月升',
            moonset: '月落',
        },
        intervals: {
            'moonless-night': '无月黑夜',
            'milky-way': '银河时段',
        },
        legend: {
            origin: '用户位置',
            sunBefore: '太阳前 30 分钟',
            sunEvent: '太阳事件时刻',
            sunAfter: '太阳后 30 分钟',
            moonBefore: '月亮前 30 分钟',
            moonEvent: '月亮事件时刻',
            moonAfter: '月亮后 30 分钟',
            currentSun: '当前太阳方位',
            currentMoon: '当前月亮方位',
        },
        phases: ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'],
    },
    en: {
        dateLabel: 'Date',
        eventSelectorLabel: 'Choose event',
        eventButtonTitles: {
            all: 'Show all Sun and Moon direction lines',
            sunrise: 'Show only sunrise direction lines',
            sunset: 'Show only sunset direction lines',
            moonrise: 'Show only moonrise direction lines',
            moonset: 'Show only moonset direction lines',
        },
        languageToggleLabel: 'Switch to Chinese',
        collapsePanelLabel: 'Collapse to direction-line mode',
        expandCompactPanelLabel: 'Expand panel',
        expandPanelLabel: 'Show fullscreen',
        restorePanelLabel: 'Restore compact window',
        fitDirectionLinesLabel: distance => `Fit ${distance} direction lines`,
        restoreSearchZoomLabel: 'Restore search-location zoom',
        enableRadarOverlayLabel: 'Enable radar overlay',
        disableRadarOverlayLabel: 'Disable radar overlay',
        panelIntro: 'Key sun and moon times, direction lines 30 minutes before and after each event, and night observing windows.',
        sunMoonPanelLabel: 'Sun and moon information panel',
        summaryViewsLabel: 'Sun and moon information views',
        astronomyPanelLabel: (date, isToday) => isToday ? 'Today’s astronomy windows' : `Astronomy windows for ${date}`,
        currentMoonPhaseLabel: 'Moon phase',
        astronomyEventsLabel: (date, isToday) => isToday ? 'Today’s astronomy events' : `Astronomy events for ${date}`,
        nightObservationWindowsLabel: 'Night observing windows',
        observationEvidenceLabel: 'Weather evidence for the observing window',
        observationEvidenceLoading: 'Matching forecast to this window…',
        observationEvidenceOutsideRange: 'This date is outside the current five-day forecast',
        observationEvidenceMissing: 'No forecast data is available for this window',
        observationEvidencePartial: 'The current forecast covers only part of this window',
        observationEvidenceUnavailable: 'Observing weather is unavailable',
        observationMetricLabels: {
            totalCloudPercent: 'Clouds',
            precipMm: 'Precip.',
            visibilityKm: 'Visibility',
        },
        mapLegendLabel: 'Map legend',
        eventDirectionLinesLabel: event => `${event} direction-line data`,
        favoriteLocationsLabel: 'Favorite locations',
        locationCopyLabel: location => `${location}. Copy coordinates`,
        favoriteLocationsCountLabel: count => `Open ${count} favorite locations`,
        saveCurrentLocationFavoriteLabel: 'Save current location',
        removeCurrentLocationFavoriteLabel: 'Remove current location from favorites',
        pinCurrentLocationLabel: 'Pin current location',
        unpinCurrentLocationLabel: 'Unpin current location',
        eventTab: 'Events',
        weatherTab: 'Weather',
        guideTab: 'Guide',
        settingsTab: 'Settings',
        aboutTab: 'About',
        aboutTabUpdateBadge: 'NEW',
        aboutTabUpdateLabel: version => `About, version ${version} is available`,
        retry: 'Retry',
        eventTimeSuffix: ' time',
        now: 'Now',
        currentDirectionsLabel: 'Current sun and moon directions',
        sun: 'Sun',
        moon: 'Moon',
        altitude: '∠',
        locationResolvingLabel: 'Resolving place…',
        elevationLabel: 'Elevation',
        calculating: 'Calculating…',
        noInterval: 'No window today',
        intervalUnavailable: 'Unavailable',
        timelineEnded: 'Today’s astronomy windows have ended',
        timelinePrefix: '',
        timelineStartSuffix: 'starts in',
        moonPhaseLoading: 'Calculating phase',
        lightPollutionLoadError: 'Unable to load light pollution data. Please try again.',
        lightPollutionOutOfBounds: 'This location is outside atlas coverage (65°S to 75°N).',
        aboutDescription: 'Solar event lines are solid; moonrise and moonset lines are dashed. Each event includes directions 30 minutes before, at the event, and 30 minutes after.',
        guideHeading: 'Map guide',
        featureGuideHeading: 'Feature guide',
        buttonHintsHeading: 'Button hints',
        buttonHintsDescription: 'Pause the pointer over an icon or compact control to see what it does. The same name is also exposed to keyboard and screen-reader users.',
        featureGuide: {
            cloudPlanning: {
                title: 'Cloud planning and time controls',
                description: 'Use the six rise/set buttons to select the Sun, Moon or Galactic Center and its event time. Enter local time or drag the minute slider while keeping the selected body. The map selector sits beside the buttons; forecast step, time input and slider share the next row. Satellite imagery uses its own observation time, independently of future forecasts. Both views support Windy forecast base, cloud-cover profile, temperature/dew-point profile or manual altitude. Single view uses the lowest detected layer. Layered view classifies by height above model terrain; a forecast base fills only one band. Temperature/dew-point thresholds estimate candidate layers, not measured bases. The table and map share sightline intersections and distance references; open the illustrated guide to understand them. Local cloud heights do not describe distant clouds. Geometry excludes intervening terrain, cloud thickness and extinction, and cannot guarantee visibility or colorful twilight.',
            },
            weatherSources: {
                title: 'Weather sources and models',
                description: 'Select Windy / Open-Meteo and EC, GFS or ICON for the weather table, observing windows and favorite comparisons. Cloud heights and map clouds always use Windy. AOD comes from CAMS. Windy visibility uses an Open-Meteo supplement; Open-Meteo visibility follows the selected model. Cloud bands and time steps can differ. Missing values stay empty; failed requests can be retried without switching sources automatically.',
            },
            units: {
                title: 'Display units',
                description: 'Temperature, wind, precipitation, distance and elevation follow Windy preferences. Manual cloud heights use the current elevation unit. Cloud base above ground and cloud altitude above sea level are labeled separately and must not be confused.',
            },

            favorites: {
                title: 'Favorite locations',
                description: 'Use the bookmark button to save or remove the current location. The list shows distance, elevation, and light pollution, with sorting by distance, recency, elevation, or light pollution.',
            },
            comparison: {
                title: 'Favorite location comparison',
                description: 'Select 2–5 favorites to compare moonless and Milky Way windows, weather, light pollution, and moon phase for the same observing date.',
            },
            coordinates: {
                title: 'Exact coordinate location',
                description: 'Choose WGS84 or GCJ-02 from the search menu and enter latitude and longitude separately. GCJ-02 is converted to the WGS84 coordinates used by Windy. Use Hide to save space; turn off “Hide location search” in Settings to restore it.',
            },
            observationEvidence: {
                title: 'Observing-window evidence',
                description: 'Moonless and Milky Way windows now show total cloud cover, precipitation, and visibility from the selected weather source and forecast model.',
            },
            mobileMode: {
                title: 'Mobile direction-line mode',
                description: 'Collapse the panel while keeping search, date, event, live directions, and daily event times. The direction-line or compact choice is remembered.',
            },
            mapControls: {
                title: 'Map view controls',
                description: 'Use “−” in the title bar or above the mobile window to fit the full direction-line range, and “+” to restore the detailed search-location zoom. In Clouds, these controls fit all cloud references or focus on the horizon and intersections.',
            },
            radarOverlay: {
                title: 'Weather radar overlay',
                description: 'Use the radar button in the title bar or above the mobile window to toggle RainViewer. The active button is highlighted, radar follows Windy’s timeline, and opacity is adjustable in Settings.',
            },
        },
        settingsGuideHeading: 'Settings guide',
        settingsHeading: 'Plugin settings',
        initialOverlayLabel: 'Layer when opening the plugin',
        initialOverlayDescription: 'Switch to the selected Windy layer immediately and keep using it whenever the plugin opens. Choose “Keep Windy’s current layer” to leave it unchanged. This setting is saved in this browser.',
        keepCurrentOverlayLabel: 'Keep Windy’s current layer',
        radarProviderLabel: 'Radar data overlay',
        radarProviderDescription: 'The window radar button and this setting stay synchronized, and either one directly toggles the overlay. When enabled, RainViewer follows Windy’s timeline. The setting stays in this browser.',
        radarProviderLabels: {
            none: 'Off',
            rainviewer: 'RainViewer (no key required)',
        },
        radarStatusLabels: {
            disabled: 'Radar overlay is off',
            loading: 'Loading radar overlay…',
            ready: 'Radar overlay loaded',
            'out-of-range': 'The selected Windy time is outside the third-party radar range',
            error: 'Radar overlay failed to load. Check the network.',
        },
        rainViewerDescription: 'RainViewer uses its keyless public API and the NMC color scale. Drag Windy’s bottom timeline to switch between available historical frames.',
        radarOpacityLabel: 'Radar overlay opacity',
        radarOpacityDescription: 'Adjust the third-party radar layer immediately. 0% is fully transparent and 100% is fully opaque. This setting is saved in this browser.',
        lineOpacityLabel: 'Line opacity',
        lineOpacityDescription: 'Adjust all sun/moon bearings, galactic centre sightlines and cloud reference lines on the map. This setting is saved in this browser.',
        show600Label: distance => `Show ${distance} point`,
        show600Description: distance => `When enabled, event direction lines extend to ${distance} and add a reference point there. This setting is saved in this browser.`,
        locationSearchHiddenNotice: 'Location search hidden. Turn off “Hide location search” in Settings to show it again.',
        hideLocationSearchLabel: 'Hide location search',
        hideLocationSearchDescription: 'Hide place-name and coordinate search without removing saved map API keys. This setting is saved in this browser.',
        locationApiKeyLabel: 'Domestic location search API keys',
        locationApiKeyPlaceholder: 'Enter API Key',
        locationApiKeyDescription: 'Configure Amap, Baidu, and Tencent, then switch providers in search. Keys stay in this browser.',
        locationApiKeySave: 'Save',
        locationApiKeyClear: 'Clear',
        locationApiKeySaved: 'Saved',
        locationProviderLabels: {
            amap: 'Amap Web Service API Key',
            baidu: 'Baidu JavaScript API Key',
            tencent: 'Tencent WebService API Key',
        },
        locationProviderDescriptions: {
            amap: 'Uses Amap input tips and converts GCJ-02 results to Windy coordinates.',
            baidu: 'Uses Baidu JSAPI 4.0 local search and converts BD-09 results to Windy coordinates.',
            tencent: 'Uses Tencent keyword suggestions and converts GCJ-02 results to Windy coordinates.',
        },
        locationProviderApplyLabels: {
            amap: 'Apply for Amap Key',
            baidu: 'Apply for Baidu Key',
            tencent: 'Apply for Tencent Key',
        },
        aboutHeading: 'About plugin',
        aboutAuthorLabel: 'Author',
        aboutVersionLabel: 'Version',
        aboutCurrentVersionDateLabel: 'Updated',
        aboutLinksLabel: 'Project links',
        aboutGithubLabel: 'GitHub',
        aboutIssuesLabel: 'Issues',
        aboutStarLabel: 'Star',
        aboutStarHint: 'If this plugin helps, please consider starring it on GitHub.',
        aboutSupportLabel: 'Like it? Treat the author to MIXUE',
        aboutXiaohongshuLabel: 'RedNote',
        aboutXiaohongshuHint: 'Follow me on Xiaohongshu (RedNote)',
        supportGuideHint: 'If this plugin helps, you can support its development and maintenance through the optional Afdian link in About, or follow the author on RedNote.',
        aboutUpdateChecking: 'Checking for a new version…',
        aboutUpdateCurrent: 'No new version is available.',
        aboutUpdateAvailable: 'New version available',
        aboutBetaAvailable: 'Beta update preview',
        aboutUpdateError: 'Unable to check for a new version.',
        aboutUpdateRetry: 'Retry',
        aboutUpdateNotesUnavailable: 'The user-facing update notes could not be loaded.',
        aboutUpdateNotesRetry: 'Reload update notes',
        aboutUpdateNotesRetrying: 'Reloading…',
        aboutCopyLatestPluginLink: version => `Copy ${version} plugin link`,
        aboutPluginLinkCopied: version => `Copied ${version} plugin link`,
        aboutPluginLinkCopyError: 'Copy failed. Try again.',
        aboutUpdateTypeLabels: {
            new: 'New',
            improved: 'Improved',
            fixed: 'Fixed',
        },
        weatherLoadError: 'Unable to load weather model data. Please try again.',
        atmosphereLoadError: 'Unable to load supplementary atmosphere data from Open-Meteo.',
        timeZoneLoadError: 'Unable to load the observer time zone. Please try again.',
        timeZoneInvalidError: 'Windy returned an invalid observer time zone. Please try again.',
        astronomyLoadError: 'Unable to calculate sun and moon directions. Please try again.',
        weatherLegend: {
            heading: 'Weather legend',
            cloud: 'Cloud cover',
            cloudDescription: 'More white fill means more cloud. Total cover shows overall obstruction; high, medium, and low show cloud-layer height.',
            temperature: 'Temperature',
            temperatureDescription: unit => `Colors progress from colder to hotter. Values are in ${unit}.`,
            dewPoint: 'Dew point',
            dewPointDescription: unit => `Green means lower condensation risk, yellow needs attention, and red means condensation is likely. Values are in ${unit}.`,
            humidity: 'Humidity',
            humidityDescription: 'Higher humidity means a greater need to watch for condensation.',
            precipitation: 'Precipitation',
            precipitationDescription: (warning, danger, unit) =>
                `Yellow is below ${warning} ${unit}, orange is ${warning}–${danger} ${unit}, and red is above ${danger} ${unit}.`,
            windSpeed: 'Wind speed',
            windSpeedDescription: (warning, danger, unit, beaufort) =>
                `Green is up to ${warning} ${unit}, yellow is above ${warning} through ${danger} ${unit}, and red is above ${danger} ${unit}.${beaufort ? ' When Windy uses bft, cells show bft/m/s together and colors use exact m/s.' : ''}`,
            windDirection: 'Wind direction',
            windDirectionDescription: 'The arrow points toward the direction the wind comes from.',
            visibility: 'Visibility',
            visibilityDescription: unit => `Sample values are in ${unit}. Higher values usually mean clearer air over longer distances.`,
            aerosolAod: 'Aerosol AOD',
            aerosolAodDescription: 'AOD is total-column aerosol optical depth at 550 nm. From left to right, the samples mean very low, low, elevated, and high. Lower values usually mean less light attenuation by aerosols, but AOD cannot be converted directly into visibility. AOD is supplied by Open-Meteo from CAMS independently of the EC, GFS, or ICON selection. Visibility follows the selected weather source as described above.',
            celestialEvents: 'Sun and moon rise/set times',
            celestialEventsDescription: 'Sun and moon icons identify the celestial body; ↑ means rise and ↓ means set. Times use the observer location\'s local time.',
        },
        events: {
            all: 'All',
            sunrise: 'Sunrise',
            sunset: 'Sunset',
            moonrise: 'Moonrise',
            moonset: 'Moonset',
        },
        timeline: {
            dawn: 'Blue',
            sunrise: 'Sunrise',
            sunset: 'Sunset',
            moonrise: 'Moonrise',
            moonset: 'Moonset',
        },
        intervals: {
            'moonless-night': 'Moonless night',
            'milky-way': 'Milky Way',
        },
        legend: {
            origin: 'Observer',
            sunBefore: 'Sun -30 min',
            sunEvent: 'Sun event',
            sunAfter: 'Sun +30 min',
            moonBefore: 'Moon -30 min',
            moonEvent: 'Moon event',
            moonAfter: 'Moon +30 min',
            currentSun: 'Current sun',
            currentMoon: 'Current moon',
        },
        phases: ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
    },
};

export type PluginText = typeof translations.zh;
