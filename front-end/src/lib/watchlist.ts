import { Movie, SavedFilm, SavedShowtime } from '../types/Movie';
import { readStorage } from './schedule';

export const savedFilmsKey = 'cinecompass_saved_films';
const validFilms = (value: unknown): value is SavedFilm[] => Array.isArray(value) && value.every(f => f && typeof f.id === 'string' && typeof f.title === 'string' && typeof f.posterPath === 'string' && (f.year === undefined || typeof f.year === 'number') && (f.duration === undefined || (typeof f.duration === 'number' && Number.isFinite(f.duration) && f.duration > 0)) && ['spokenLanguages','availableSubtitles'].every(key => f[key] === undefined || (Array.isArray(f[key]) && f[key].every((language: unknown) => typeof language === 'string'))));
export const savedFilm = (movie: Movie): SavedFilm => ({id:movie.id,title:movie.title,posterPath:movie.poster_path,...(movie.releaseYear ? {year:movie.releaseYear} : {}),...(movie.duration > 0 ? {duration:movie.duration} : {}),...(movie.spokenLanguages.length ? {spokenLanguages:movie.spokenLanguages} : {}),...(movie.availableSubtitles.length ? {availableSubtitles:movie.availableSubtitles} : {})});
export function loadSavedFilms(screenings: SavedShowtime[]): SavedFilm[] {
  // An explicit empty list must not resurrect films removed from the watchlist.
  try {
    if (localStorage.getItem(savedFilmsKey) !== null) return readStorage(savedFilmsKey, [], validFilms);
  } catch { return []; }
  const films = new Map<string,SavedFilm>();
  for (const s of screenings) films.set(s.movieId, {id:s.movieId,title:s.movieTitle,posterPath:s.posterPath || ''});
  return Array.from(films.values());
}
