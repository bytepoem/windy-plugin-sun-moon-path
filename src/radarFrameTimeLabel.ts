import type { RadarOverlayStatus, RadarProvider } from './radarOverlay';

export type RadarFrameTimeLabelState = {
    language: 'zh' | 'en';
    provider: RadarProvider;
    status: RadarOverlayStatus;
    timestampMs: number | null;
};

export type RadarFrameTimeLabelController = {
    destroy: () => void;
    update: (state: RadarFrameTimeLabelState) => void;
};

/** Format the actual third-party radar frame without duplicating Windy's selected-time text. */
export const formatRadarFrameTimeLabel = (state: RadarFrameTimeLabelState): string | null => {
    if (state.provider === 'none' || state.status === 'disabled' || state.status === 'error') {
        return null;
    }
    const source = 'RainViewer';
    if (state.timestampMs !== null) {
        const time = new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-US', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).format(new Date(state.timestampMs));
        return `${source} · ${time}`;
    }
    if (state.status === 'out-of-range') {
        return state.language === 'zh'
            ? `${source} · 无对应时次`
            : `${source} · No matching frame`;
    }
    return state.language === 'zh'
        ? `${source} · 加载中…`
        : `${source} · Loading…`;
};

const findWindyTimecode = (): HTMLElement | null => (
    document.querySelector<HTMLElement>('#plugin-radar-plus .timecode')
    || document.querySelector<HTMLElement>('.radsat__left .timecode')
);

const isRadarTimelineNode = (node: Node): boolean => {
    if (!(node instanceof Element)) {
        return false;
    }
    const timelineSelector = '#plugin-radar-plus, .radsat__left';
    return node.matches(timelineSelector)
        || Boolean(node.closest(timelineSelector))
        || Boolean(node.querySelector(timelineSelector));
};

/** Own the label injected above Windy's native radar/satellite timecode and remove it on plugin close. */
export const createRadarFrameTimeLabel = (): RadarFrameTimeLabelController => {
    const element = document.createElement('div');
    element.className = 'sun-path-radar-frame-time';
    document.body.append(element);
    let currentText: string | null = null;
    let positionFrame: number | null = null;
    let observedTimecode: HTMLElement | null = null;
    let observedLayoutRoot: HTMLElement | null = null;
    let positionLabel = () => undefined;

    const schedulePosition = () => {
        if (positionFrame !== null) {
            return;
        }
        positionFrame = requestAnimationFrame(() => {
            positionFrame = null;
            positionLabel();
        });
    };

    const resizeObserver = new ResizeObserver(() => {
        schedulePosition();
    });

    const observeLayout = (timecode: HTMLElement) => {
        const layoutRoot = timecode.closest<HTMLElement>('#bottom-wrapper') || timecode.parentElement;
        if (observedTimecode === timecode && observedLayoutRoot === layoutRoot) {
            return;
        }
        resizeObserver.disconnect();
        observedTimecode = timecode;
        observedLayoutRoot = layoutRoot;
        resizeObserver.observe(timecode);
        if (layoutRoot && layoutRoot !== timecode) {
            resizeObserver.observe(layoutRoot);
        }
    };

    positionLabel = () => {
        const timecode = findWindyTimecode();
        if (!timecode || currentText === null) {
            element.hidden = true;
            return;
        }
        observeLayout(timecode);
        const rect = timecode.getBoundingClientRect();
        element.hidden = false;
        element.style.left = `${rect.left + rect.width / 2}px`;
        element.style.top = `${Math.max(4, rect.top - 28)}px`;
    };

    const observer = new MutationObserver(records => {
        const timelineChanged = records.some(record => (
            isRadarTimelineNode(record.target)
            || Array.from(record.addedNodes).some(isRadarTimelineNode)
            || Array.from(record.removedNodes).some(isRadarTimelineNode)
        ));
        if (timelineChanged) {
            schedulePosition();
        }
    });
    observer.observe(document.body, {
        attributeFilter: ['class', 'style'],
        attributes: true,
        childList: true,
        subtree: true,
    });
    window.addEventListener('resize', schedulePosition);

    const update = (state: RadarFrameTimeLabelState) => {
        currentText = formatRadarFrameTimeLabel(state);
        if (currentText === null) {
            element.hidden = true;
            return;
        }
        element.hidden = false;
        element.textContent = currentText;
        element.title = currentText;
        positionLabel();
    };

    const destroy = () => {
        observer.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('resize', schedulePosition);
        if (positionFrame !== null) {
            cancelAnimationFrame(positionFrame);
            positionFrame = null;
        }
        element.remove();
    };

    return { destroy, update };
};
