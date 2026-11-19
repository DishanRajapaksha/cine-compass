import React, { createContext, useContext } from 'react';
import { ListPlus } from 'lucide-react';
import { MovieList, SavedFilm } from '../types/Movie';
import { isBuiltInList } from '../lib/movieLists';

export const MovieListsContext = createContext<{
  lists: MovieList[];
  toggleFilm: (id: string, film: SavedFilm) => void;
} | null>(null);

export default function MovieListAction({film}: {film: SavedFilm}) {
  const context = useContext(MovieListsContext);
  const lists = context?.lists.filter(list => !isBuiltInList(list.id));
  if (!context || !lists?.length) return null;

  return <details className="cc-movie-list-action">
    <summary aria-label={`Add to list: ${film.title}`}><ListPlus size={16} aria-hidden="true"/> Add to list</summary>
    <fieldset>
      <legend>{film.title}</legend>
      {lists.map(list => <label key={list.id}>
        <input type="checkbox" checked={list.films.some(entry => entry.id === film.id)}
          onChange={() => context.toggleFilm(list.id, film)}/>
        {list.name}
      </label>)}
    </fieldset>
  </details>;
}
