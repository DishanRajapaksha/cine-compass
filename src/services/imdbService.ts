export type ImdbMatch = { id: string; rating: string | null };
export const IMDB_SETTINGS_EVENT = 'cinecompass-imdb-settings';
const KEY = 'cinecompass_omdb_key';
const CACHE = 'cinecompass_imdb_cache';
export function getOmdbKey(): string {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setOmdbKey(value: string) {
  if (value.trim()) localStorage.setItem(KEY, value.trim());
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(IMDB_SETTINGS_EVENT));
}

let active = 0;
const queue: (() => void)[] = [];
const pending = new Map<string, Promise<ImdbMatch | null>>();
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>(resolve => queue.push(resolve));
  else active++;
  try { return await work(); }
  finally { const next = queue.shift(); if (next) next(); else active--; }
}
type OmdbFilm = { Response?: string; Error?: string; imdbID?: string; imdbRating?: string; Year?: string };
export async function resolveImdb(title: string, year: number | undefined, key: string): Promise<ImdbMatch | null> {
  if (!key) return null;
  const cleanTitle = title.replace(/(?:\s*\([^)]*\))+\s*$/, '').trim();
  const identity = JSON.stringify([cleanTitle, year || null]);
  const requestId = JSON.stringify([key, identity]);
  if (pending.has(requestId)) return pending.get(requestId)!;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE) || '{}')[identity];
    if (cached && Date.now() - cached.ts < (cached.match ? 7 : 1) * 86400000 && (!cached.match || /^tt\d+$/.test(cached.match.id))) return cached.match;
  } catch { /* Cache is optional. */ }
  const request = limited(async () => {
    const fetchFilm = async (exactYear?: number): Promise<OmdbFilm | null> => {
      const params = new URLSearchParams({apikey:key,type:'movie',t:cleanTitle});
      if (exactYear) params.set('y',String(exactYear));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),10000);
      let response: Response;
      try {response = await fetch(`https://www.omdbapi.com/?${params}`, {credentials:'omit', signal:controller.signal});}
      finally {clearTimeout(timeout);}
      if (!response.ok) throw new Error('IMDb lookup unavailable');
      const film: OmdbFilm = await response.json();
      // API errors are not cached as film misses, so a corrected key can retry.
      if (film.Response !== 'True') {
        if (film.Error === 'Movie not found!') return null;
        throw new Error('IMDb lookup unavailable');
      }
      return film;
    };
    let film = await fetchFilm();
    const wrongYear = (candidate: OmdbFilm) => Boolean(year && (!candidate.Year || !Number.isFinite(parseInt(candidate.Year,10)) || Math.abs(parseInt(candidate.Year,10)-year)>1));
    if (film && wrongYear(film)) film = await fetchFilm(year);
    const rating = film?.imdbRating && /^(?:10|[0-9])(?:\.\d+)?$/.test(film.imdbRating) ? film.imdbRating : null;
    const match = film && !wrongYear(film) && /^tt\d+$/.test(film.imdbID || '') ? {id:film.imdbID!,rating} : null;
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE) || '{}');
      cache[identity] = {ts:Date.now(),match};
      localStorage.setItem(CACHE,JSON.stringify(cache));
    } catch { /* Lookup works without cache storage. */ }
    return match;
  }).catch(() => null).finally(() => pending.delete(requestId));
  pending.set(requestId,request);
  return request;
}
