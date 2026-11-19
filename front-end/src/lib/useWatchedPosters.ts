import { useCallback, useEffect, useState, useRef } from 'react';
import { movieService } from '../services/movieService';
import { MovieList, SavedFilm } from '../types/Movie';
import { watchedListId } from './movieLists';

const parallelLookups = 4;
const lookupKey = (film: SavedFilm) => JSON.stringify([film.id, film.title, film.year, film.posterPath]);

export default function useWatchedPosters(
  watched: SavedFilm[] | undefined,
  update: (change: (lists: MovieList[]) => MovieList[]) => boolean,
) {
  const [broken, setBroken] = useState(() => new Map<string, string>());
  const attempted = useRef(new Set<string>());
  const reportBroken = useCallback((film: SavedFilm) => {
    setBroken(previous => previous.get(film.id) === film.posterPath
      ? previous : new Map(previous).set(film.id, film.posterPath));
  }, []);

  useEffect(() => {
    if (!watched) {
      attempted.current.clear();
      return;
    }
    const missing = watched.filter(film => (!film.posterPath.trim() || broken.get(film.id) === film.posterPath) &&
      !attempted.current.has(lookupKey(film)));
    if (!missing.length) return;
    const controller = new AbortController();

    const recover = async () => {
      for (let offset = 0; offset < missing.length; offset += parallelLookups) {
        const batch = missing.slice(offset, offset + parallelLookups);
        const results = await Promise.allSettled(batch.map(async film => {
          const result = await movieService.getFilmPoster(film.id, film.title, film.year, controller.signal);
          return result?.posterPath;
        }));
        if (controller.signal.aborted) return;

        const posters = new Map<string, string>();
        results.forEach((result, index) => {
          const film = batch[index];
          const key = lookupKey(film);
          attempted.current.add(key);
          if (result.status === 'fulfilled' && result.value && result.value !== film.posterPath)
            posters.set(key, result.value);
        });
        if (!posters.size) continue;

        // Reapply only to entries that still match the lookup, including the original poster URL.
        const saved = update(lists => lists.map(list => list.id !== watchedListId ? list : {
          ...list, films: list.films.map(film => {
            const posterPath = posters.get(lookupKey(film));
            return posterPath ? {...film, posterPath} : film;
          }),
        }));
        // A successful save re-renders the list and starts the next batch.
        if (saved) return;
      }
    };

    void recover();
    return () => controller.abort();
  }, [watched, update, broken]);

  return reportBroken;
}
