import { Movie, MovieList, SavedFilm } from '../types/Movie';

export const movieListsKey = 'cinecompass_movie_lists';
export const watchlistId = 'watchlist';
export const watchedListId = 'watched';
export const legacyListKeys = ['cinecompass_saved_films', 'cinecompass_watched_movies', 'cinecompass_hidden_movies'] as const;
export function isBuiltInList(id: string) {
  return id === watchlistId || id === watchedListId;
}

export function savedFilm(movie: Movie): SavedFilm {
  return {
    id: movie.id, title: movie.title, posterPath: movie.poster_path,
    year: movie.releaseYear || undefined, duration: movie.duration > 0 ? movie.duration : undefined,
    releaseDate: movie.release_date || undefined, overview: movie.overview || undefined,
    overviewLanguage: movie.overviewLanguage, createdAt: movie.createdAt,
    directors: movie.directors?.length ? movie.directors : undefined,
    cast: movie.cast?.length ? movie.cast : undefined,
    spokenLanguages: movie.spokenLanguages?.length ? movie.spokenLanguages : undefined,
    availableSubtitles: movie.availableSubtitles?.length ? movie.availableSubtitles : undefined,
    availableLanguageVersions: movie.availableLanguageVersions?.length ? movie.availableLanguageVersions : undefined,
    availableSpecials: movie.availableSpecials?.length ? movie.availableSpecials : undefined,
  };
}

function array(value?: string): unknown[] | undefined {
  try {
    const parsed: unknown = value === undefined ? undefined : JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function filmEntries(value: unknown[]): SavedFilm[] {
  const films = new Map<string, SavedFilm>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const film = entry as SavedFilm;
    if (typeof film.id !== 'string' || typeof film.title !== 'string') continue;
    const normalized = {...film, posterPath: typeof film.posterPath === 'string' ? film.posterPath : ''};
    for (const key of ['spokenLanguages', 'availableSubtitles', 'directors', 'cast', 'availableLanguageVersions', 'availableSpecials'] as const) {
      const items = normalized[key];
      if (items !== undefined && (!Array.isArray(items) || !items.every(item => typeof item === 'string')))
        delete normalized[key];
    }
    films.set(film.id, normalized);
  }
  return Array.from(films.values());
}

export function readMovieLists(values: Record<string, string>): MovieList[] {
  const lists = new Map<string, MovieList>();
  const stored = array(values[movieListsKey]);
  for (const entry of stored ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const list = entry as MovieList;
    if (typeof list.id === 'string' && typeof list.name === 'string' && Array.isArray(list.films))
      lists.set(list.id, {
        id: list.id, name: list.name, films: filmEntries(list.films),
        hideWatched: typeof list.hideWatched === 'boolean' ? list.hideWatched : undefined,
      });
  }
  const legacyShowtimes = () => (array(values.cineville_saved_showtimes) ?? []).flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const {movieId, movieTitle, posterPath} = entry as {movieId?: string; movieTitle?: string; posterPath?: string};
    return [{id: movieId, title: movieTitle, posterPath}];
  });
  // An explicit legacy watchlist, even an empty one, takes precedence over saved showtimes.
  const watchlist = lists.get(watchlistId)?.films ?? (stored ? [] : filmEntries(
    legacyListKeys[0] in values ? array(values[legacyListKeys[0]]) ?? [] : legacyShowtimes()
  ));
  const watched = lists.get(watchedListId)?.films ?? (stored ? [] : filmEntries(array(values[legacyListKeys[1]] ?? values[legacyListKeys[2]]) ?? []));
  return [
    {id: watchlistId, name: 'Watchlist', films: watchlist},
    {id: watchedListId, name: 'Watched', films: watched},
    ...Array.from(lists.values()).filter(list => !isBuiltInList(list.id)),
  ];
}

export function normalizeMovieListSettings(values: Record<string, string>): Record<string, string> {
  const normalized = {...values};
  if ([movieListsKey, ...legacyListKeys, 'cineville_saved_showtimes'].some(key => key in values))
    normalized[movieListsKey] = JSON.stringify(readMovieLists(values));
  for (const key of legacyListKeys) delete normalized[key];
  return normalized;
}
