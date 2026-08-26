<script lang="ts">
    import bcast from '@windy/broadcast';
    import * as userFavs from '@windy/userFavs';
    import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';

    import {
        favoriteDistanceLabel,
        filterFavoritePlaceItems,
        favoriteLocationSelection,
        favoritePlaceItems,
        locationFavorites,
        matchingLocationFavorite,
        setLocationFavoriteState,
        type FavoritePlaceItem,
        type FavoriteSortMode,
        type LocationFavorite,
    } from './favoritePlaces';
    import { compactLocationLabel } from './location';
    import type { LocationSearchSelection } from './locationProvider';
    import type { Coordinates } from './solar';

    export let open = false;
    export let count = 0;
    export let location: Coordinates;
    export let locationName = '';
    export let locationNameResolved = false;
    export let distanceOrigin: Coordinates | null = null;
    export let language: 'zh' | 'en' = 'zh';
    export let returnFocus: HTMLElement | null = null;
    export let currentSaved = false;
    export let currentActionDisabled = true;

    const dispatch = createEventDispatcher<{
        select: LocationSearchSelection;
    }>();
    const labels = {
        zh: {
            panel: '收藏',
            orderedByDistance: '距离最近',
            orderedByRecent: '时间最近',
            sortLabel: '收藏排序方式',
            close: '关闭收藏地点',
            current: '当前',
            search: '搜索收藏地点',
            searchResults: (total: number) => `找到 ${total} 个收藏地点。`,
            noMatches: '没有匹配的收藏地点。',
            loading: '正在读取收藏地点…',
            empty: '还没有收藏地点，可以先收藏当前观测地点。',
            loadError: '无法读取收藏地点。',
            retry: '重试',
            saved: '已收藏当前地点',
            removed: '已取消收藏当前地点',
            actionError: '收藏操作失败，请稍后重试。',
        },
        en: {
            panel: 'Favorites',
            orderedByDistance: 'Nearest',
            orderedByRecent: 'Most recent',
            sortLabel: 'Sort favorites',
            close: 'Close favorite locations',
            current: 'Current',
            search: 'Search favorites',
            searchResults: (total: number) => `${total} favorite locations found.`,
            noMatches: 'No matching favorite locations.',
            loading: 'Loading favorite locations…',
            empty: 'No favorite locations yet. Save the current observing location first.',
            loadError: 'Unable to load favorite locations.',
            retry: 'Retry',
            saved: 'Current location saved',
            removed: 'Current location removed from favorites',
            actionError: 'Favorite action failed. Try again later.',
        },
    } as const;
    const sortModes: FavoriteSortMode[] = ['distance', 'recent'];

    let text = labels.zh;
    let favorites: LocationFavorite[] = [];
    let items: FavoritePlaceItem[] = [];
    let filteredItems: FavoritePlaceItem[] = [];
    let currentFavorite: LocationFavorite | null = null;
    let currentTitleValue = '';
    let favoriteQuery = '';
    let sortMode: FavoriteSortMode = 'distance';
    let currentSortLabel = '';
    let sortMenuOpen = false;
    let sortMenuIndex = 0;
    let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let feedback = '';
    let actionPending = false;
    let requestId = 0;
    let actionRequestId = 0;
    let destroyed = false;
    let previousOpen = false;
    let panelElement: HTMLElement | null = null;
    let searchInputElement: HTMLInputElement | null = null;
    let sortButtonElement: HTMLButtonElement | null = null;
    let sortMenuElement: HTMLElement | null = null;

    $: text = labels[language];
    $: currentSortLabel = sortMode === 'distance' ? text.orderedByDistance : text.orderedByRecent;
    $: count = favorites.length;
    $: currentTitleValue = locationName.trim()
        || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`;
    $: currentFavorite = matchingLocationFavorite(favorites, location, currentTitleValue);
    $: items = favoritePlaceItems(favorites, location, distanceOrigin, currentTitleValue, sortMode);
    $: filteredItems = filterFavoritePlaceItems(items, favoriteQuery);
    $: currentSaved = Boolean(currentFavorite);
    $: currentActionDisabled = actionPending || status !== 'ready' || !locationNameResolved;
    $: {
        if (open !== previousOpen) {
            previousOpen = open;
            if (open) {
                feedback = '';
                favoriteQuery = '';
                sortMenuOpen = false;
                void refreshFavorites(true).then(async () => {
                    if (!open || destroyed) {
                        return;
                    }
                    await tick();
                    const searchInput = panelElement?.querySelector<HTMLInputElement>(
                        '.favorite-locations__heading-search input:not(:disabled)',
                    );
                    if (searchInput) {
                        searchInput.focus();
                        return;
                    }
                    panelElement?.querySelector<HTMLButtonElement>('.favorite-locations__close')?.focus();
                });
            } else {
                sortMenuOpen = false;
            }
        }
    }

    const localizedDistance = (item: FavoritePlaceItem, currentLabel: string): string => {
        const label = favoriteDistanceLabel(item.distanceKm, item.isCurrent);
        return label === 'current' ? currentLabel : label;
    };

    const refreshFavorites = async (showLoading = open) => {
        if (destroyed) {
            return;
        }
        const ownRequestId = ++requestId;
        if (showLoading) {
            status = 'loading';
        }
        try {
            const nextFavorites = locationFavorites(await userFavs.getAll());
            if (destroyed || ownRequestId !== requestId) {
                return;
            }
            favorites = nextFavorites;
            status = 'ready';
        } catch {
            if (destroyed || ownRequestId !== requestId) {
                return;
            }
            status = 'error';
        }
    };

    const handleFavoriteChange = () => {
        void refreshFavorites(open);
    };

    const closePanel = (restoreFocus = true) => {
        sortMenuOpen = false;
        open = false;
        if (restoreFocus) {
            void tick().then(() => returnFocus?.focus());
        }
    };

    export const toggleCurrentFavorite = async () => {
        if (currentActionDisabled || destroyed) {
            return;
        }
        const ownActionRequestId = ++actionRequestId;
        const targetState = currentFavorite ? 'removed' : 'saved';
        actionPending = true;
        feedback = '';
        try {
            await setLocationFavoriteState({
                api: {
                    getAll: userFavs.getAll,
                    add: item => userFavs.add(item),
                    remove: id => userFavs.remove(id),
                },
                location,
                title: currentTitleValue,
                targetState,
            });
            if (destroyed || ownActionRequestId !== actionRequestId) {
                return;
            }
            feedback = targetState === 'removed' ? text.removed : text.saved;
            await refreshFavorites(false);
        } catch {
            if (!destroyed && ownActionRequestId === actionRequestId) {
                feedback = text.actionError;
            }
        } finally {
            if (!destroyed && ownActionRequestId === actionRequestId) {
                actionPending = false;
            }
        }
    };

    const selectFavorite = (favorite: LocationFavorite) => {
        dispatch('select', favoriteLocationSelection(favorite, distanceOrigin));
        closePanel();
    };

    const focusSortOption = async () => {
        await tick();
        sortMenuElement
            ?.querySelectorAll<HTMLButtonElement>('[role="option"]')[sortMenuIndex]
            ?.focus();
    };

    const openSortMenu = (index = sortModes.indexOf(sortMode)) => {
        sortMenuIndex = Math.max(0, index);
        sortMenuOpen = true;
        void focusSortOption();
    };

    const closeSortMenu = (restoreFocus = false) => {
        sortMenuOpen = false;
        if (restoreFocus) {
            void tick().then(() => sortButtonElement?.focus());
        }
    };

    const chooseSortMode = (nextSortMode: FavoriteSortMode, index: number) => {
        sortMode = nextSortMode;
        sortMenuIndex = index;
        closeSortMenu(true);
    };

    const handleSortButtonKeydown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const selectedIndex = sortModes.indexOf(sortMode);
            const nextIndex = event.key === 'ArrowDown'
                ? (selectedIndex + 1) % sortModes.length
                : (selectedIndex - 1 + sortModes.length) % sortModes.length;
            openSortMenu(nextIndex);
        } else if (event.key === 'Escape' && sortMenuOpen) {
            event.preventDefault();
            event.stopPropagation();
            closeSortMenu(true);
        }
    };

    const handleSortOptionKeydown = (event: KeyboardEvent, index: number) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeSortMenu(true);
            return;
        }
        if (event.key === 'Tab') {
            sortMenuOpen = false;
            return;
        }
        let nextIndex = index;
        if (event.key === 'ArrowDown') {
            nextIndex = (index + 1) % sortModes.length;
        } else if (event.key === 'ArrowUp') {
            nextIndex = (index - 1 + sortModes.length) % sortModes.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = sortModes.length - 1;
        } else {
            return;
        }
        event.preventDefault();
        sortMenuIndex = nextIndex;
        void focusSortOption();
    };

    const handlePanelPointerDown = (event: PointerEvent) => {
        if (!sortMenuOpen || !(event.target instanceof Element)) {
            return;
        }
        if (!event.target.closest('.favorite-locations__heading-order')) {
            sortMenuOpen = false;
        }
    };

    const handlePanelKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            if (sortMenuOpen) {
                event.preventDefault();
                event.stopPropagation();
                closeSortMenu(true);
                return;
            }
            if (favoriteQuery) {
                event.preventDefault();
                event.stopPropagation();
                favoriteQuery = '';
                void tick().then(() => searchInputElement?.focus());
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            closePanel();
        }
    };

    onMount(() => {
        bcast.on('favChanged', handleFavoriteChange);
        void refreshFavorites(false);
    });

    onDestroy(() => {
        destroyed = true;
        requestId += 1;
        actionRequestId += 1;
        bcast.off('favChanged', handleFavoriteChange);
    });
</script>

{#if open}
    <section
        id="favorite-locations-panel"
        class="favorite-locations"
        class:sort-menu-open={sortMenuOpen}
        role="dialog"
        bind:this={panelElement}
        aria-label={text.panel}
        on:pointerdown={handlePanelPointerDown}
        on:keydown={handlePanelKeydown}
    >
        <header class="favorite-locations__heading">
            <strong class="favorite-locations__heading-title">{text.panel}</strong>
            <label class="favorite-locations__heading-search">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="10.5" cy="10.5" r="5.5"></circle>
                    <path d="m15 15 4 4"></path>
                </svg>
                <span class="favorite-locations__search-label">{text.search}</span>
                <input
                    type="search"
                    bind:this={searchInputElement}
                    bind:value={favoriteQuery}
                    placeholder={text.search}
                    autocomplete="off"
                    disabled={status !== 'ready' || items.length === 0}
                    aria-controls={status === 'ready' && items.length > 0 ? 'favorite-locations-list' : undefined}
                    aria-describedby="favorite-locations-search-status"
                />
            </label>
            <div class="favorite-locations__heading-order">
                <span>{text.sortLabel}</span>
                <button
                    type="button"
                    class="favorite-locations__sort-button"
                    bind:this={sortButtonElement}
                    aria-label={`${text.sortLabel}: ${currentSortLabel}`}
                    aria-haspopup="listbox"
                    aria-expanded={sortMenuOpen}
                    aria-controls={sortMenuOpen ? 'favorite-locations-sort-menu' : undefined}
                    on:click={() => sortMenuOpen ? closeSortMenu() : openSortMenu()}
                    on:keydown={handleSortButtonKeydown}
                >
                    <span>{currentSortLabel}</span>
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="m4 6 4 4 4-4"></path>
                    </svg>
                </button>
                {#if sortMenuOpen}
                    <div
                        id="favorite-locations-sort-menu"
                        class="favorite-locations__sort-menu"
                        bind:this={sortMenuElement}
                        role="listbox"
                        aria-label={text.sortLabel}
                    >
                        {#each sortModes as option, index}
                            <button
                                type="button"
                                role="option"
                                aria-selected={sortMode === option}
                                tabindex={index === sortMenuIndex ? 0 : -1}
                                class:active={sortMode === option}
                                on:click={() => chooseSortMode(option, index)}
                                on:keydown={event => handleSortOptionKeydown(event, index)}
                            >
                                <span>{option === 'distance' ? text.orderedByDistance : text.orderedByRecent}</span>
                                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                    {#if sortMode === option}
                                        <path d="m3 8 3 3 7-7"></path>
                                    {/if}
                                </svg>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
            <button type="button" class="favorite-locations__close" aria-label={text.close} on:click={() => closePanel()}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M6 6l12 12M18 6 6 18"></path>
                </svg>
            </button>
        </header>

        <div
            id="favorite-locations-search-status"
            class="favorite-locations__search-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            {#if status === 'loading'}
                {text.loading}
            {:else if status === 'ready' && favoriteQuery}
                {filteredItems.length > 0 ? text.searchResults(filteredItems.length) : text.noMatches}
            {/if}
        </div>

        {#if status === 'loading'}
            <div class="favorite-locations__message">{text.loading}</div>
        {:else if status === 'error'}
            <div class="favorite-locations__message favorite-locations__message--error" role="alert">
                <span>{text.loadError}</span>
                <button type="button" on:click={() => void refreshFavorites(true)}>{text.retry}</button>
            </div>
        {:else if items.length === 0}
            <div class="favorite-locations__message">{text.empty}</div>
        {:else if filteredItems.length === 0}
            <div
                id="favorite-locations-list"
                class="favorite-locations__message favorite-locations__message--compact"
            >{text.noMatches}</div>
        {:else}
            <div id="favorite-locations-list" class="favorite-locations__list" aria-label={text.panel}>
                {#each filteredItems as item (item.favorite.id)}
                    <button
                        type="button"
                        aria-current={item.isCurrent ? 'location' : undefined}
                        class:current={item.isCurrent}
                        on:click={() => selectFavorite(item.favorite)}
                    >
                        <svg class="favorite-locations__pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"></path>
                            <circle cx="12" cy="10" r="2"></circle>
                        </svg>
                        <span class="favorite-locations__name" title={item.favorite.title}>
                            {compactLocationLabel(item.favorite.title)}
                        </span>
                        <span class="favorite-locations__distance">{localizedDistance(item, text.current)}</span>
                        <svg class="favorite-locations__selected" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="m5 12 4 4L19 6"></path>
                        </svg>
                    </button>
                {/each}
            </div>
        {/if}

    </section>
{/if}

<div class="favorite-locations__feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</div>

<style lang="less">
    .favorite-locations {
        position: absolute;
        z-index: 24;
        top: calc(100% + 4px);
        right: 0;
        left: 0;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 8px;
        background: #172237;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.46);
        color: var(--panel-text);
    }

    .favorite-locations.sort-menu-open {
        min-height: 134px;
    }

    .favorite-locations__heading {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto 40px;
        gap: 6px;
        align-items: center;
        min-height: 40px;
        padding: 0 0 0 12px;
        border-bottom: 1px solid var(--panel-border);
    }

    .favorite-locations__heading-title {
        font-size: 13px;
        white-space: nowrap;
    }

    .favorite-locations__heading-order {
        position: relative;
        display: flex;
        align-items: center;
        width: 88px;
        min-width: 0;
    }

    .favorite-locations__heading-order > span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    .favorite-locations__sort-button {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 12px;
        gap: 4px;
        align-items: center;
        width: 100%;
        height: 30px;
        padding: 0 6px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--panel-muted);
        background: rgba(8, 15, 27, 0.56);
        font: inherit;
        font-size: 10px;
        cursor: pointer;
        touch-action: manipulation;
    }

    .favorite-locations__sort-button > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-locations__sort-button svg,
    .favorite-locations__sort-menu svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .favorite-locations__sort-button:hover,
    .favorite-locations__sort-button[aria-expanded='true'] {
        border-color: var(--panel-accent);
        color: var(--panel-text);
        background: rgba(99, 185, 238, 0.14);
    }

    .favorite-locations__sort-button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .favorite-locations__sort-menu {
        position: absolute;
        z-index: 5;
        top: calc(100% + 4px);
        right: 0;
        display: grid;
        box-sizing: border-box;
        width: 100%;
        padding: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 7px;
        background: #172237;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.42);
    }

    .favorite-locations__sort-menu button {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 12px;
        gap: 4px;
        align-items: center;
        min-height: 40px;
        padding: 0 6px;
        border: 0;
        border-radius: 5px;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 10px;
        text-align: left;
        cursor: pointer;
        touch-action: manipulation;
    }

    .favorite-locations__sort-menu button:hover,
    .favorite-locations__sort-menu button.active {
        color: var(--panel-text);
        background: rgba(99, 185, 238, 0.18);
    }

    .favorite-locations__sort-menu button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .favorite-locations__heading-search {
        position: relative;
        display: flex;
        align-items: center;
        height: 28px;
        min-width: 0;
        border: 1px solid var(--panel-border);
        overflow: hidden;
        border-radius: 7px;
        background: rgba(8, 15, 27, 0.56);
        color: var(--panel-muted);
        transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .favorite-locations__heading-search:focus-within {
        border-color: var(--panel-accent);
        box-shadow: 0 0 0 1px rgba(99, 185, 238, 0.18);
    }

    .favorite-locations__heading-search svg {
        position: absolute;
        left: 7px;
        width: 13px;
        height: 13px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        pointer-events: none;
    }

    .favorite-locations__heading-search input {
        width: 100%;
        min-width: 0;
        height: 26px;
        padding: 0 7px 0 25px;
        border: 0;
        border-radius: inherit;
        outline: 0;
        background: transparent;
        color: var(--panel-text);
        font: inherit;
        font-size: 10px;
    }

    .favorite-locations__heading-search input::placeholder {
        color: var(--panel-muted);
    }

    .favorite-locations__heading-search input:disabled {
        cursor: wait;
        opacity: 0.55;
    }

    .favorite-locations__close {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--panel-muted);
        cursor: pointer;
    }

    .favorite-locations__close svg,
    .favorite-locations__list svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .favorite-locations__close svg {
        width: 18px;
        height: 18px;
    }

    .favorite-locations__close:hover {
        color: var(--panel-text);
        background: rgba(255, 255, 255, 0.08);
    }

    .favorite-locations__close:focus-visible,
    .favorite-locations__list button:focus-visible,
    .favorite-locations__message button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -3px;
    }

    .favorite-locations__search-label,
    .favorite-locations__search-status {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    .favorite-locations__list {
        max-height: 220px;
        margin: 6px;
        overflow-y: auto;
        border: 1px solid var(--panel-border);
        border-radius: 7px;
    }

    .favorite-locations__list button {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr) auto 18px;
        gap: 8px;
        align-items: center;
        width: 100%;
        min-height: 42px;
        padding: 4px 8px;
        border: 0;
        border-bottom: 1px solid var(--panel-border);
        background: transparent;
        color: var(--panel-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .favorite-locations__list button:last-child {
        border-bottom: 0;
    }

    .favorite-locations__list button:hover,
    .favorite-locations__list button.current {
        background: rgba(99, 185, 238, 0.16);
    }

    .favorite-locations__pin,
    .favorite-locations__selected {
        width: 16px;
        height: 16px;
        color: var(--panel-accent);
    }

    .favorite-locations__name {
        min-width: 0;
        overflow: hidden;
        font-size: 12px;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-locations__distance {
        color: var(--panel-muted);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .favorite-locations__selected {
        visibility: hidden;
    }

    .favorite-locations__list button.current .favorite-locations__selected {
        visibility: visible;
    }

    .favorite-locations__message {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
        min-height: 72px;
        padding: 12px;
        color: var(--panel-muted);
        font-size: 11px;
        text-align: center;
    }

    .favorite-locations__message--compact {
        min-height: 54px;
    }

    .favorite-locations__message--error {
        color: #ffb4ad;
    }

    .favorite-locations__message button {
        min-height: 32px;
        padding: 0 9px;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--panel-accent);
        cursor: pointer;
    }

    .favorite-locations__feedback {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    @media (max-width: 600px) {
        .favorite-locations.sort-menu-open {
            min-height: 138px;
        }

        .favorite-locations__heading {
            grid-template-columns: auto minmax(0, 1fr) auto 44px;
            min-height: 44px;
        }

        .favorite-locations__close {
            width: 44px;
            height: 44px;
        }

        .favorite-locations__list {
            max-height: min(210px, calc(36dvh - env(safe-area-inset-bottom, 0px)));
        }

        .favorite-locations__list button {
            min-height: 44px;
        }

    }

    @media (max-width: 420px) {
        .favorite-locations__heading {
            gap: 4px;
            padding-left: 8px;
        }

        .favorite-locations__heading-title,
        .favorite-locations__sort-button,
        .favorite-locations__sort-menu button {
            font-size: 10px;
        }

        .favorite-locations__heading-order {
            width: 82px;
        }

        .favorite-locations__sort-button {
            padding-right: 5px;
            padding-left: 5px;
        }

        .favorite-locations__heading-search input {
            padding-right: 5px;
            padding-left: 23px;
            font-size: 9px;
        }

        .favorite-locations__heading-search svg {
            left: 6px;
            width: 12px;
            height: 12px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .favorite-locations * {
            transition: none !important;
        }
    }
</style>
