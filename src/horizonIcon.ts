/** Render a decorative horizon symbol for the panel and Leaflet's HTML markers.
 * Callers supply fixed sizes and palette colours; the horizon is at y = 18 of 24.
 */
export const renderHorizonIcon = (body: 'sun' | 'moon' | 'galactic', size: number, color: string): string => {
    const symbol = body === 'sun'
        ? '<circle fill="currentColor" cx="12" cy="17" r="5" /><path d="M12 5v3M3.5 8.5l2.1 2.1M20.5 8.5l-2.1 2.1M2 16h2M20 16h2" />'
        : body === 'moon'
            ? '<path fill="currentColor" d="M19.6 18.2A8.4 8.4 0 0 1 8.8 7.4A8.6 8.6 0 1 0 19.6 18.2Z" />'
            : '<g transform="translate(0 3)"><path d="M12 9c-5-5-10 1-6 6s14 3 13-3S9 2 5 7m7 8c5 5 10-1 6-6S4 6 5 12s10 10 14 5" /><circle fill="currentColor" cx="12" cy="12" r="1.5" /></g>';
    // A nested SVG clips the body without IDs that could collide across markers.
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:0 0 auto;color:${color}"><svg width="24" height="18" viewBox="0 0 24 18" style="overflow:hidden">${symbol}</svg><path d="M2 18h20" /></svg>`;
};
