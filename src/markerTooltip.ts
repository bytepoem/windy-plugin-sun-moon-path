/** Bound tooltip lifetime also covers touch/focus opens, where mouseout may never fire.
 * The owning overlay must release this binding before removing its marker.
 */
export const manageMarkerTooltip = (marker: L.Marker) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
        if (timer !== null) { clearTimeout(timer); timer = null; }
    };
    const close = () => { cancel(); marker.closeTooltip(); };
    const open = () => { cancel(); timer = setTimeout(close, 2000); };
    marker.on('mouseout', close);
    marker.on('tooltipopen', open);
    marker.on('tooltipclose', cancel);
    return () => {
        cancel();
        marker.off('mouseout', close);
        marker.off('tooltipopen', open);
        marker.off('tooltipclose', cancel);
        marker.closeTooltip();
        marker.unbindTooltip();
    };
};
