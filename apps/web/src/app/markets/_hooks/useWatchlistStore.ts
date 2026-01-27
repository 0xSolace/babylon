import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
    favorites: string[]; // List of market IDs/Tickers
    toggleFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
    persist(
        (set, get) => ({
            favorites: [],
            toggleFavorite: (id) =>
                set((state) => ({
                    favorites: state.favorites.includes(id)
                        ? state.favorites.filter((fav) => fav !== id)
                        : [...state.favorites, id],
                })),
            isFavorite: (id) => get().favorites.includes(id),
        }),
        {
            name: 'babylon-watchlist-storage',
        }
    )
);
