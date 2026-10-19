/** Svelte 4 client-only failure boundary. Its behavior is covered against the installed runtime. */
declare module 'svelte/internal' {
    interface ComponentState {
        $$: {
            fragment: unknown;
            on_mount: (() => unknown)[];
            before_update: (() => unknown)[];
            after_update: (() => unknown)[];
        };
    }
    export const current_component: ComponentState | undefined;
    export function get_current_component(): ComponentState;
    export function set_current_component(component: ComponentState | undefined): void;
}
