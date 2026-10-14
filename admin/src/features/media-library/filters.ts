/**
 * Narrowing the media library to what someone is looking for.
 *
 * Pure functions, so the rules for "which records show" are tested on their
 * own and the page only has to render the answer.
 */
import type { MediaAsset } from '../../services/firebase/mediaAssets';
import type { MediaCategory, MediaKind } from '../../services/media/types';
import { matchesSearch } from '../../components/media/assetDisplay';

export type KindFilter = 'all' | MediaKind;
export type CategoryFilter = 'all' | MediaCategory;

export interface LibraryFilters {
  search: string;
  kind: KindFilter;
  category: CategoryFilter;
}

export const INITIAL_FILTERS: LibraryFilters = {
  search: '',
  kind: 'all',
  category: 'all',
};

/** How many records the page draws before "Show more". */
export const PAGE_SIZE = 48;

export const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Videos & links' },
];

export function filterAssets(
  assets: MediaAsset[],
  filters: LibraryFilters
): MediaAsset[] {
  return assets.filter(
    (asset) =>
      (filters.kind === 'all' || asset.kind === filters.kind) &&
      (filters.category === 'all' || asset.category === filters.category) &&
      matchesSearch(asset, filters.search)
  );
}

/** The number on each tab. Counted before the search, so a tab never reads "0" because of a typo. */
export function countByKind(assets: MediaAsset[]): Record<KindFilter, number> {
  const counts: Record<KindFilter, number> = {
    all: assets.length,
    image: 0,
    audio: 0,
    video: 0,
  };
  for (const asset of assets) counts[asset.kind] += 1;
  return counts;
}

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return (
    filters.search.trim() !== '' || filters.kind !== 'all' || filters.category !== 'all'
  );
}
