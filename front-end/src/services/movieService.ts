import {
  City,
  CinevilleFilm,
  CinevilleResponse,
  CinevilleShowtime,
  CinevilleTheater,
  CinevilleTheatersResponse,
  Movie,
  MovieFilters,
  MovieResponse,
  Theater
} from '../types/Movie';
import { normalizeLanguageCode } from '../lib/utils';

const CINEVILLE_API_URL = 'https://api.cineville.nl';
const EVENTS_SEARCH_URL = `${CINEVILLE_API_URL}/events/search`;
const VENUES_URL = `${CINEVILLE_API_URL}/venues`;
const API_LOCALE = '*';
const PRIMARY_LOCALE = 'en-GB';
const FALLBACK_LOCALE = 'nl-NL';
const PAGE_LIMIT = 999;

type EventSearchBody = Record<string, unknown>;

type NormalizedFilm = {
  id: string;
  title: string;
  posterUrl: string;
  premiereDate: string | null;
  shortDescription: string;
  description: string;
  duration: number;
  directors: string[];
  cast: string[];
  releaseYear: number;
  spokenLanguages: string[];
};

type NormalizedShowtime = {
  id: string;
  startDate: string;
  endDate: string;
  theater: CinevilleTheater;
  ticketingUrl: string | null;
  specials: string;
  subtitles: string;
  languageVersion: string | null;
};

const isNonEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value as object).some(isNonEmptyValue);
  return true;
};

const getLocalizedValue = <T>(attributes: Record<string, unknown>, field: string): T | undefined => {
  const candidates = [
    attributes[field],
    (attributes[PRIMARY_LOCALE] as Record<string, unknown> | undefined)?.[field],
    (attributes[FALLBACK_LOCALE] as Record<string, unknown> | undefined)?.[field]
  ];
  return candidates.find(isNonEmptyValue) as T | undefined;
};

const stringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeFilm = (film: CinevilleFilm): NormalizedFilm => {
  const attributes = film.attributes;
  const poster = film.assets.poster ?? film.assets.cover;
  return {
    id: film.id,
    title: film.title,
    posterUrl: poster?.url ?? '',
    premiereDate: typeof attributes.premiereDate === 'string' ? attributes.premiereDate : null,
    shortDescription: getLocalizedValue<string>(film.localizableAttributes, 'shortDescription') ?? '',
    description: getLocalizedValue<string>(film.localizableAttributes, 'description') ?? '',
    duration: typeof attributes.duration === 'number' ? attributes.duration : 0,
    directors: stringArray(attributes.directors),
    cast: stringArray(attributes.cast),
    releaseYear: typeof attributes.releaseYear === 'number' ? attributes.releaseYear : 0,
    spokenLanguages: stringArray(attributes.spokenLanguages)
  };
};

const normalizeSubtitles = (event: CinevilleShowtime): string =>
  stringArray(event.attributes.subtitles).join(', ');

const normalizeSpecials = (event: CinevilleShowtime): string => {
  const tags = stringArray(event.attributes.tags);
  const customTags = stringArray(getLocalizedValue<unknown>(event.localizableAttributes, 'customTags'));
  return Array.from(new Set([...tags, ...customTags])).join(', ');
};

const calculateEndDate = (startDate: string, duration: number): string => {
  if (!duration) return startDate;
  const end = new Date(startDate);
  end.setMinutes(end.getMinutes() + duration + 15);
  end.setMinutes(Math.floor(end.getMinutes() / 5) * 5, 0, 0);
  return end.toISOString();
};

const normalizeEvent = (
  event: CinevilleShowtime,
  film: NormalizedFilm
): NormalizedShowtime | null => {
  const theater = event._embedded.venue;
  if (!theater) return null;
  return {
    id: event.id,
    startDate: event.startDate,
    endDate: event.endDate ?? calculateEndDate(event.startDate, film.duration),
    theater,
    ticketingUrl: event.ticketingUrl,
    specials: normalizeSpecials(event),
    subtitles: normalizeSubtitles(event),
    languageVersion:
      typeof event.attributes.languageVersion === 'string'
        ? event.attributes.languageVersion
        : null
  };
};

const convertCinevilleFilmToMovie = (
  film: NormalizedFilm,
  showtimes: NormalizedShowtime[]
): Movie => {
  const availableSubtitles = Array.from(new Set(
    showtimes.map(showtime => showtime.subtitles).filter(Boolean)
  ));
  const availableLanguageVersions = Array.from(new Set(
    showtimes.map(showtime => showtime.languageVersion?.trim() ?? '').filter(Boolean)
  ));
  const availableSpecials = Array.from(new Set(
    showtimes.map(showtime => showtime.specials).filter(Boolean)
  ));

  return {
    id: film.id,
    title: film.title,
    poster_path: film.posterUrl,
    release_date: film.premiereDate || (film.releaseYear ? `${film.releaseYear}-01-01` : ''),
    overview: film.shortDescription || film.description || 'No description available.',
    vote_average: 0,
    genre_ids: [],
    duration: film.duration,
    directors: film.directors,
    cast: film.cast,
    releaseYear: film.releaseYear,
    spokenLanguages: film.spokenLanguages,
    availableSubtitles,
    availableLanguageVersions,
    availableSpecials,
    showtimes: showtimes.map(showtime => ({
      id: showtime.id,
      startDate: showtime.startDate,
      endDate: showtime.endDate,
      theaterId: showtime.theater.id,
      theaterName: showtime.theater.name,
      theaterCity: showtime.theater.address.city,
      ticketingUrl: showtime.ticketingUrl,
      specials: showtime.specials || null,
      subtitles: showtime.subtitles,
      languageVersion: showtime.languageVersion
    }))
  };
};

const getDateRange = (filters?: MovieFilters) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (filters?.startDate) {
    startDate = new Date(filters.startDate);
    if (filters.startTime) {
      const [hours, minutes] = filters.startTime.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }
  } else {
    startDate = new Date(now);
  }

  if (filters?.endDate) {
    endDate = new Date(filters.endDate);
    if (filters.endTime) {
      const [hours, minutes] = filters.endTime.split(':').map(Number);
      endDate.setHours(hours, minutes, 59, 999);
    } else {
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  return { gte: startDate.toISOString(), lt: endDate.toISOString() };
};

let allTheaterIdsCache: string[] | null = null;
let theatersCache: CinevilleTheater[] | null = null;
let theatersPromise: Promise<CinevilleTheater[]> | null = null;
const cityTheaterIdsCache = new Map<string, string[]>();
const eventRequests = new Map<string, Promise<CinevilleResponse>>();

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Cineville API request failed with ${response.status}`);
  return response.json() as Promise<T>;
};

const loadTheaters = async (): Promise<CinevilleTheater[]> => {
  if (theatersCache) return theatersCache;
  if (theatersPromise) return theatersPromise;

  theatersPromise = (async () => {
    const venues: CinevilleTheater[] = [];
    let nextUrl: string | undefined = VENUES_URL;
    while (nextUrl) {
      const page: CinevilleTheatersResponse = await fetchJson<CinevilleTheatersResponse>(
        nextUrl.startsWith('http') ? nextUrl : `${CINEVILLE_API_URL}${nextUrl}`
      );
      venues.push(...page._embedded.venues.filter(venue => !venue.isHidden));
      nextUrl = page._links.next?.href;
    }
    theatersCache = venues;
    return venues;
  })();

  try {
    return await theatersPromise;
  } finally {
    theatersPromise = null;
  }
};

const getAllTheaterIds = async (): Promise<string[]> => {
  if (allTheaterIdsCache) return allTheaterIdsCache;
  allTheaterIdsCache = (await loadTheaters()).map(theater => theater.id);
  return allTheaterIdsCache;
};

const getTheaterIdsByCity = async (cityName: string): Promise<string[]> => {
  const cached = cityTheaterIdsCache.get(cityName);
  if (cached) return cached;
  const ids = (await loadTheaters())
    .filter(theater => theater.address.city === cityName)
    .map(theater => theater.id);
  cityTheaterIdsCache.set(cityName, ids);
  return ids;
};

const resolveVenueIds = async (filters?: MovieFilters): Promise<string[]> => {
  if (filters?.selectedTheaters?.length) return filters.selectedTheaters;
  if (filters?.selectedCity) return getTheaterIdsByCity(filters.selectedCity);
  return getAllTheaterIds();
};

const buildEventSearchBody = async (
  filters?: MovieFilters,
  includeSubtitleFilter = false
): Promise<EventSearchBody> => {
  const venueIds = await resolveVenueIds(filters);
  const body: EventSearchBody = {
    startDate: getDateRange(filters),
    productionId: { isNull: false },
    isHidden: { eq: false },
    embed: { production: true, venue: true },
    sort: { startDate: 'asc' },
    page: { limit: PAGE_LIMIT }
  };
  if (venueIds.length) body.venueId = { in: venueIds };
  if (includeSubtitleFilter && filters?.selectedSubtitleLanguages?.length) {
    body.subtitles = { contains: filters.selectedSubtitleLanguages };
  }
  return body;
};

const searchEvents = async (body: EventSearchBody): Promise<CinevilleResponse> => {
  const cacheKey = JSON.stringify(body);
  const cached = eventRequests.get(cacheKey);
  if (cached) return cached;

  const request = fetchJson<CinevilleResponse>(EVENTS_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      locale: API_LOCALE
    },
    body: cacheKey
  });
  eventRequests.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    eventRequests.delete(cacheKey);
    throw error;
  }
};

const moviesFromEvents = (events: CinevilleShowtime[], filters?: MovieFilters, includePosterless = false): Movie[] => {
  const grouped = new Map<string, { film: NormalizedFilm; showtimes: NormalizedShowtime[] }>();
  const selectedSpecials = filters?.selectedSpecials ?? [];

  events.forEach(event => {
    const rawFilm = event._embedded.production;
    if (!rawFilm) return;
    const film = normalizeFilm(rawFilm);
    const showtime = normalizeEvent(event, film);
    if (!showtime) return;
    if (
      selectedSpecials.length > 0 &&
      !selectedSpecials.some(selected =>
        showtime.specials.toLowerCase().includes(selected.toLowerCase())
      )
    ) return;

    const entry = grouped.get(film.id) ?? { film, showtimes: [] };
    entry.showtimes.push(showtime);
    grouped.set(film.id, entry);
  });

  let movies = Array.from(grouped.values())
    .map(({ film, showtimes }) => convertCinevilleFilmToMovie(film, showtimes))
    .filter(movie => includePosterless || movie.poster_path);

  if (filters?.selectedSubtitleLanguages?.length) {
    movies = movies.filter(movie => filters.selectedSubtitleLanguages.some(selected =>
      movie.availableSubtitles.some(available =>
        available.toLowerCase().includes(selected.toLowerCase())
      )
    ));
  }
  if (filters?.selectedSpokenLanguages?.length) {
    movies = movies.filter(movie => filters.selectedSpokenLanguages.some(selected =>
      movie.spokenLanguages.some(available =>
        normalizeLanguageCode(available) === normalizeLanguageCode(selected)
      )
    ));
  }
  return movies;
};

const asMovieResponse = (movies: Movie[]): MovieResponse => ({
  page: 1,
  results: movies,
  total_pages: 1,
  total_results: movies.length
});

export const movieService = {
  getAvailableLanguages: async (): Promise<{ subtitleLanguages: string[] }> => ({
    subtitleLanguages: ['en']
  }),

  getAvailableSpecials: async (filters?: MovieFilters): Promise<{ specials: string[] }> => {
    try {
      const response = await searchEvents(await buildEventSearchBody(filters));
      const specials = new Set<string>();
      response._embedded.events.forEach(event => {
        const value = normalizeSpecials(event);
        if (value) specials.add(value);
      });
      return { specials: Array.from(specials).sort() };
    } catch (error) {
      console.error('Error fetching specials from Cineville API:', error);
      return { specials: [] };
    }
  },

  getTheaters: async (): Promise<City[]> => {
    try {
      const theatersByCity = new Map<string, Theater[]>();
      (await loadTheaters()).forEach(theater => {
        const city = theater.address.city;
        const theaters = theatersByCity.get(city) ?? [];
        theaters.push({ id: theater.id, name: theater.name, city });
        theatersByCity.set(city, theaters);
      });
      return Array.from(theatersByCity.entries())
        .map(([name, theaters]) => ({
          name,
          theaters: theaters.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching theaters from Cineville API:', error);
      throw new Error('Failed to fetch theaters');
    }
  },

  getPopularMovies: async (filters?: MovieFilters, includePosterless = false): Promise<MovieResponse> => {
    try {
      const response = await searchEvents(await buildEventSearchBody(filters, true));
      return asMovieResponse(moviesFromEvents(response._embedded.events, filters, includePosterless));
    } catch (error) {
      console.error('Error fetching movies from Cineville API:', error);
      throw new Error('Failed to fetch movies');
    }
  },

  getMovieShowtimes: async (movieId: string, filters?: MovieFilters): Promise<Movie | null> => {
    const body = await buildEventSearchBody(filters);
    body.productionId = { eq: movieId };
    if (!filters?.endDate) delete (body.startDate as Record<string, unknown>).lt;
    const events: CinevilleShowtime[] = [];
    let nextUrl: string | undefined = EVENTS_SEARCH_URL;
    const visited = new Set<string>();
    while (nextUrl) {
      if (visited.has(nextUrl)) throw new Error('Repeated showtime page');
      visited.add(nextUrl);
      const response: CinevilleResponse = await fetchJson<CinevilleResponse>(nextUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', locale: API_LOCALE }, body: JSON.stringify(body)
      });
      events.push(...response._embedded.events);
      const href: string | undefined = response._links.next?.href;
      nextUrl = href ? new URL(href, CINEVILLE_API_URL).href : undefined;
    }
    return moviesFromEvents(events, filters, true).find(movie => movie.id === movieId) || null;
  },

  searchMovies: async (query: string, filters?: MovieFilters): Promise<MovieResponse> => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return asMovieResponse([]);
    try {
      const response = await searchEvents(await buildEventSearchBody(filters, true));
      const movies = moviesFromEvents(response._embedded.events, filters)
        .filter(movie => movie.title.toLocaleLowerCase().includes(normalizedQuery));
      return asMovieResponse(movies);
    } catch (error) {
      console.error('Error searching movies from Cineville API:', error);
      throw new Error('Failed to search movies');
    }
  }
};
