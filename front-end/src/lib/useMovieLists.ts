import { useCallback, useEffect, useState } from 'react';
import { MovieList, SavedFilm } from '../types/Movie';
import { setPreference, snapshot } from './accountStorage';
import { isBuiltInList, legacyListKeys, movieListsKey, readMovieLists } from './movieLists';

export default function useMovieLists() {
  const [lists, setLists] = useState(() => {
    try { return readMovieLists(snapshot()); }
    catch { return readMovieLists({}); }
  });
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const migrated = snapshot()[movieListsKey];
      if (migrated !== undefined) setPreference(movieListsKey, migrated);
      for (const key of legacyListKeys) localStorage.removeItem(key);
    } catch {
      setError('Movie lists could not be loaded. Check your browser storage and try again.');
    }
    const sync = (event: StorageEvent) => {
      if (event.key === movieListsKey || event.key === null) setLists(readMovieLists(snapshot()));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const update = useCallback((change: (current: MovieList[]) => MovieList[]) => {
    try {
      const current = readMovieLists(snapshot());
      const next = change(current);
      const serialized = JSON.stringify(next);
      if (serialized !== JSON.stringify(current)) setPreference(movieListsKey, serialized);
      setLists(next);
      setError('');
      return true;
    } catch {
      setError('Movie lists could not be saved. Check your browser storage and try again.');
      return false;
    }
  }, []);

  const changeFilms = (id: string, change: (films: SavedFilm[]) => SavedFilm[]) =>
    update(current => current.map(list => list.id === id ? {...list, films: change(list.films)} : list));
  const removeFilm = (listId: string, filmId: string) =>
    changeFilms(listId, films => films.filter(film => film.id !== filmId));

  return {
    lists, error, update, changeFilms, removeFilm,
    toggleFilm: (id: string, film: SavedFilm) => changeFilms(id, films =>
      films.some(existing => existing.id === film.id) ? films.filter(existing => existing.id !== film.id) : [...films, film]),
    create: (name: string) => {
      const id = window.crypto.randomUUID();
      return update(current => [...current, {id, name, films: []}]) ? id : undefined;
    },
    rename: (id: string, name: string) =>
      !isBuiltInList(id) && update(current => current.map(list => list.id === id ? {...list, name} : list)),
    setHideWatched: (id: string, hideWatched: boolean) =>
      !isBuiltInList(id) && update(current => current.map(list => list.id === id ? {...list, hideWatched} : list)),
    remove: (id: string) =>
      !isBuiltInList(id) && update(current => current.filter(list => list.id !== id)),
  };
}
