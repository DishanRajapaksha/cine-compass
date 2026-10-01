import { Movie, MovieFilters, MovieShowtime } from '../types/Movie';
import { normalizeLanguageCode, hasEnglishSubtitles } from './utils';

export const amsterdamDate = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));
export const screeningTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hour12: false
}).format(new Date(value));
export const dateLabel = (value: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long'
}).format(new Date(`${value}T12:00:00+02:00`));
export const languageName = (code: string) => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(normalizeLanguageCode(code)) || code; }
  catch { return code; }
};
export type Screening = { movie: Movie; showtime: MovieShowtime };
export function filterScreenings(movies: Movie[], filters: MovieFilters, query: string): Screening[] {
  return movies.flatMap(movie => movie.showtimes.map(showtime => ({ movie, showtime })))
    .filter(({movie, showtime}) => {
      const date = amsterdamDate(showtime.startDate);
      const time = screeningTime(showtime.startDate);
      const languageMatches: boolean[] = [];
      if (filters.selectedSubtitleLanguages.length) languageMatches.push(filters.selectedSubtitleLanguages.some(lang => lang === 'en' ? hasEnglishSubtitles(showtime.subtitles) : showtime.subtitles.toLowerCase().split(/[^a-z-]+/).includes(lang)));
      if (filters.selectedSpokenLanguages.length) languageMatches.push(movie.spokenLanguages.some(lang => filters.selectedSpokenLanguages.includes(normalizeLanguageCode(lang))));
      const matchesLanguage = !languageMatches.length || (filters.languageMatchMode === 'any' ? languageMatches.some(Boolean) : languageMatches.every(Boolean));
      return movie.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
        (!filters.selectedCity || showtime.theaterCity === filters.selectedCity) &&
        (!filters.selectedTheaters.length || filters.selectedTheaters.includes(showtime.theaterId)) &&
        (!filters.startDate || date >= filters.startDate) && (!filters.endDate || date <= filters.endDate) &&
        (!filters.startTime || time >= filters.startTime) && (!filters.endTime || time <= filters.endTime) &&
        matchesLanguage &&
        (!filters.selectedSpecials.length || filters.selectedSpecials.some(special => (showtime.specials || '').toLowerCase().includes(special.toLowerCase())));
    }).sort((a, b) => Date.parse(a.showtime.startDate) - Date.parse(b.showtime.startDate) || a.movie.title.localeCompare(b.movie.title));
}
export function readStorage<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || 'null'); return valid(value) ? value : fallback; }
  catch { return fallback; }
}
export function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing remains available without storage. */ }
}
