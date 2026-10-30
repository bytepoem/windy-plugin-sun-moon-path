import { getContext, onDestroy, onMount } from 'svelte';
import { current_component, get_current_component, set_current_component } from 'svelte/internal';

export const PLUGIN_LIFECYCLE = Symbol('sun-moon-path-lifecycle');

/** Own resource cleanup even when Svelte's constructor throws before returning an instance. */
export const createPluginLifecycle = () => {
    let disposed = false;
    const cleanups = new Set<() => void>();
    const components = new Set<ReturnType<typeof get_current_component>>();
    const own = (callback: () => void) => {
        let active = true;
        const cleanup = () => {
            if (!active) { return; }
            active = false;
            cleanups.delete(cleanup);
            callback();
        };
        if (disposed) { cleanup(); }
        else { cleanups.add(cleanup); }
        return cleanup;
    };
    return {
        get disposed() { return disposed; },
        own,
        track(component: ReturnType<typeof get_current_component>) {
            if (components.has(component)) { return false; }
            components.add(component);
            return true;
        },
        untrack(component: ReturnType<typeof get_current_component>) { components.delete(component); },
        abortConstruction() {
            // Svelte 4 does not return a failed constructor instance, and its dirty queue may
            // still reference a half-mounted fragment. Retire those fragments before cleanup
            // invalidates state. Resource teardown is owned by this scope; the entry removes DOM.
            for (const component of components) {
                component.$$.fragment = null;
                component.$$.on_mount = [];
                component.$$.before_update = [];
                component.$$.after_update = [];
            }
            components.clear();
        },
        dispose() {
            if (disposed) { return; }
            disposed = true;
            // Children register after parents. Stop their asynchronous work before parent teardown.
            for (const cleanup of [...cleanups].reverse()) {
                try { cleanup(); } catch { /* One host teardown failure must not prevent remaining cleanup. */ }
            }
            components.clear();
        },
    };
};
export type PluginLifecycle = ReturnType<typeof createPluginLifecycle>;

export const currentPluginLifecycle = () => {
    const scope = getContext<PluginLifecycle | undefined>(PLUGIN_LIFECYCLE);
    // SSR has no client component; server render tests only need the cleanup registration.
    if (scope) {
        const component = get_current_component();
        if (scope.track(component)) { onDestroy(() => scope.untrack(component)); }
    }
    return scope;
};

/** Restore Svelte 4's global context even if init throws before restoring its parent. */
export const constructPlugin = <T>(create: () => T): T => {
    const previous = current_component;
    try { return create(); }
    finally { set_current_component(previous); }
};

/** Normal Svelte teardown and startup-abort teardown share one idempotent cleanup. */
export const onPluginDestroy = (callback: () => void) => {
    const scope = currentPluginLifecycle();
    onDestroy(scope ? scope.own(callback) : callback);
};

/** Svelte may flush queued mount callbacks while constructing the failure report. */
export const onPluginMount = (callback: () => void | (() => void)) => {
    const scope = currentPluginLifecycle();
    onMount(() => {
        if (scope?.disposed) { return; }
        const cleanup = callback();
        return typeof cleanup === 'function' && scope ? scope.own(cleanup) : cleanup;
    });
};
