import { distanceKm, type Coordinates } from './solar';
import type { LocationSearchSelection } from './locationProvider';

export const FAVORITE_LOCATION_MATCH_TOLERANCE_KM = 0.001;
export const SAME_NAMED_FAVORITE_MATCH_TOLERANCE_KM = 0.1;

export type WindyFavorite = {
    [key: string]: unknown;
    id: string;
    type: string;
    title: string;
    lat: number;
    lon: number;
    updated: number;
};

export type LocationFavorite = WindyFavorite & { type: 'fav' };

export type FavoritePlaceItem = {
    favorite: LocationFavorite;
    distanceKm: number | null;
    isCurrent: boolean;
};

export type FavoriteSortMode = 'distance' | 'recent';

export type FavoriteMutationApi = {
    getAll: () => Promise<WindyFavorite[]>;
    add: (favorite: { type: 'fav'; title: string; lat: number; lon: number }) => Promise<string | null>;
    remove: (id: string) => Promise<void>;
};

export const locationFavorites = (favorites: WindyFavorite[]): LocationFavorite[] =>
    favorites.filter((favorite): favorite is LocationFavorite =>
        favorite.type === 'fav' && Number.isFinite(favorite.lat) && Number.isFinite(favorite.lon),
    );

const normalizedFavoriteTitle = (title: string): string => title
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');

const matchingLocationFavorites = (
    favorites: LocationFavorite[],
    location: Coordinates,
    title = '',
    coordinateToleranceKm = FAVORITE_LOCATION_MATCH_TOLERANCE_KM,
    sameNamedToleranceKm = SAME_NAMED_FAVORITE_MATCH_TOLERANCE_KM,
): LocationFavorite[] => {
    const normalizedTitle = normalizedFavoriteTitle(title);
    const matches: { favorite: LocationFavorite; distance: number }[] = [];
    for (const favorite of favorites) {
        const candidateDistance = distanceKm(favorite, location);
        const hasSameTitle = normalizedTitle.length > 0
            && normalizedFavoriteTitle(favorite.title) === normalizedTitle;
        const isSameLocation = candidateDistance <= coordinateToleranceKm
            || (hasSameTitle && candidateDistance <= sameNamedToleranceKm);
        if (isSameLocation) {
            matches.push({ favorite, distance: candidateDistance });
        }
    }
    return matches
        .sort((first, second) => first.distance - second.distance)
        .map(match => match.favorite);
};

export const matchingLocationFavorite = (
    favorites: LocationFavorite[],
    location: Coordinates,
    title = '',
    coordinateToleranceKm = FAVORITE_LOCATION_MATCH_TOLERANCE_KM,
    sameNamedToleranceKm = SAME_NAMED_FAVORITE_MATCH_TOLERANCE_KM,
): LocationFavorite | null => matchingLocationFavorites(
    favorites,
    location,
    title,
    coordinateToleranceKm,
    sameNamedToleranceKm,
)[0] || null;

export const favoritePlaceItems = (
    favorites: LocationFavorite[],
    currentLocation: Coordinates,
    distanceOrigin: Coordinates | null,
    currentTitle = '',
    sortMode: FavoriteSortMode = 'distance',
): FavoritePlaceItem[] => {
    const currentFavorite = matchingLocationFavorite(favorites, currentLocation, currentTitle);
    const items = favorites
    .map(favorite => ({
        favorite,
        distanceKm: distanceOrigin ? distanceKm(distanceOrigin, favorite) : null,
        isCurrent: favorite.id === currentFavorite?.id,
    }));
    if (sortMode === 'recent') {
        return items.sort((first, second) => second.favorite.updated - first.favorite.updated);
    }
    return items.sort((first, second) => {
        const distanceOrder = (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity);
        if (distanceOrder !== 0) {
            return distanceOrder;
        }
        return second.favorite.updated - first.favorite.updated;
    });
};

export const filterFavoritePlaceItems = (
    items: FavoritePlaceItem[],
    query: string,
): FavoritePlaceItem[] => {
    const normalizedQuery = normalizedFavoriteTitle(query).toLocaleLowerCase();
    if (!normalizedQuery) {
        return items;
    }
    return items.filter(item => normalizedFavoriteTitle(item.favorite.title)
        .toLocaleLowerCase()
        .includes(normalizedQuery));
};

export const favoriteDistanceLabel = (distance: number | null, isCurrent: boolean): string => {
    if (isCurrent) {
        return 'current';
    }
    if (distance === null) {
        return '--';
    }
    if (distance < 1) {
        return `${Math.max(1, Math.round(distance * 1_000))} m`;
    }
    return `${Math.round(distance)} km`;
};

export const favoriteLocationSelection = (
    favorite: LocationFavorite,
    distanceOrigin: Coordinates | null,
): LocationSearchSelection => ({
    id: `favorite:${favorite.id}`,
    name: favorite.title,
    district: '',
    address: '',
    province: '',
    city: '',
    area: '',
    distanceKm: distanceOrigin ? distanceKm(distanceOrigin, favorite) : null,
    wgs84: { lat: favorite.lat, lon: favorite.lon },
    elevationM: undefined,
});

export const setLocationFavoriteState = async ({
    api,
    location,
    title,
    targetState,
}: {
    api: FavoriteMutationApi;
    location: Coordinates;
    title: string;
    targetState: 'saved' | 'removed';
}): Promise<'saved' | 'removed' | 'unchanged'> => {
    const existing = matchingLocationFavorites(locationFavorites(await api.getAll()), location, title);
    if (targetState === 'removed') {
        if (!existing.length) {
            return 'unchanged';
        }
        for (const favorite of existing) {
            await api.remove(favorite.id);
        }
        return 'removed';
    }
    if (existing.length) {
        return 'unchanged';
    }

    const addedId = await api.add({
        type: 'fav',
        title,
        lat: location.lat,
        lon: location.lon,
    });
    if (!addedId) {
        throw new Error('Favorite was not added');
    }
    return 'saved';
};
