<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from 'svelte';
    import store from '@windy/store';
    import plugins from '@windy/plugins';
    import type { CloudSettings } from './cloudProfile';
    import type { WeatherModel } from './weather';

    // Clouds and Horizon share one synchronization session across view switches.
    // The session never owns the satellite observation clock.
    export let settings: CloudSettings;
    export let model: WeatherModel;
    export let timestamp: number | null;
    export let previewingTime: boolean;
    export let syncError = false;
    export let syncing = false;
    export let mapTimestamp: number | null = null;
    export let mapOverlay = '';
    export let retryRevision = 0;

    const dispatch = createEventDispatcher<{ modelchange: WeatherModel }>();
    const options = { UIident: 'windy-plugin-sun-moon-path', doNotStore: true, doNotSaveToCloud: true };
    const listeners: number[] = [];
    let mounted = false;
    let syncRevision = 0;
    let syncQueue: Promise<void> = Promise.resolve();
    let lastSyncKey = '';

    $: if (mounted && (previewingTime || timestamp === null)) {
        lastSyncKey = `preview|${timestamp}`;
        syncRevision += 1;
        syncing = false;
    }
    $: if (mounted && !previewingTime && timestamp !== null) {
        const key = `${model}|${timestamp}|${settings.overlay}|${settings.syncMap}|${retryRevision}`;
        if (!settings.syncMap && key !== lastSyncKey) {
            lastSyncKey = key;
            syncRevision += 1;
            syncing = false;
        } else if (settings.syncMap && key !== lastSyncKey) {
            lastSyncKey = key;
            synchronizeMap(model, timestamp, settings.overlay);
        }
    }

    /** Serialize host setters; invalidate remaining writes after preview, teardown or a newer selection. */
    const synchronizeMap = (nextModel: WeatherModel, instant: number, nextOverlay: CloudSettings['overlay']) => {
        const revision = ++syncRevision;
        syncing = true;
        syncError = false;
        syncQueue = syncQueue.then(async () => {
            try {
                if (!mounted || revision !== syncRevision) {return;}
                // Close the observation timeline synchronously before restoring
                // a forecast product, so its exit animation cannot overwrite time.
                if (nextOverlay !== 'satellite' && store.get('overlay') === 'satellite') {
                    plugins['radar-plus']?.close({ disableClosingAnimation: true });
                }
                if (!mounted || revision !== syncRevision) {return;}
                if (store.get('overlay') !== nextOverlay) {await store.set('overlay', nextOverlay, options);}
                if (!mounted || revision !== syncRevision) {return;}
                if (nextOverlay !== 'satellite' && store.get('product') !== nextModel) {await store.set('product', nextModel, options);}
                if (!mounted || revision !== syncRevision) {return;}
                if (nextOverlay !== 'satellite' && store.get('timestamp') !== instant) {store.set('timestamp', instant, options);}
                if (!mounted || revision !== syncRevision) {return;}
                mapTimestamp = store.get('timestamp');
                mapOverlay = store.get('overlay');
                syncError = store.get('overlay') !== nextOverlay || (nextOverlay !== 'satellite'
                    && (Math.abs(store.get('timestamp') - instant) > 1_000 || store.get('product') !== nextModel));
            } catch {
                if (mounted && revision === syncRevision) {syncError = true;}
            } finally {
                if (mounted && revision === syncRevision) {syncing = false;}
            }
        });
    };

    onMount(() => {
        mounted = true;
        mapTimestamp = store.get('timestamp');
        mapOverlay = store.get('overlay');
        listeners.push(store.on('timestamp', (value, source) => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {return;}
            mapTimestamp = value;
            // A host scrub supersedes queued plugin writes before parent props update.
            if (mounted && source !== options.UIident && value !== timestamp) {
                syncRevision += 1;
                syncing = false;
                lastSyncKey = '';
            }
            if (mounted && settings.syncMap && !syncing && settings.overlay !== 'satellite') {
                syncError = (timestamp !== null && Math.abs(value - timestamp) > 1_000)
                    || store.get('product') !== model || store.get('overlay') !== settings.overlay;
            }
        }));
        listeners.push(store.on('product', value => {
            if (!mounted || !settings.syncMap || syncing) {return;}
            if (value === 'ecmwf' || value === 'gfs' || value === 'icon') {dispatch('modelchange', value);}
            else if (value !== 'satellite') {syncError = true;}
        }));
        listeners.push(store.on('overlay', value => {
            mapOverlay = value;
            if (!mounted || !settings.syncMap || syncing) {return;}
            if (['clouds', 'lclouds', 'mclouds', 'hclouds', 'cbase', 'satellite'].includes(value)) {
                settings = { ...settings, overlay: value as CloudSettings['overlay'] };
            } else {syncError = true;}
        }));
    });

    onDestroy(() => {
        mounted = false;
        syncRevision += 1;
        listeners.forEach(id => store.off(id));
    });
</script>
