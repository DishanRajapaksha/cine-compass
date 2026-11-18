import { City, Movie, MovieFilters, MovieResponse } from '../types/Movie';

const API = '/api/cineville';

function screeningParams(filters?: MovieFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) return params;

  const fields = {
    city: filters.selectedCity,
    startDate: filters.startDate,
    endDate: filters.endDate,
    startTime: filters.startTime,
    endTime: filters.endTime
  };
  Object.entries(fields).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const lists = {
    cinema: filters.selectedTheaters,
    language: filters.selectedSpokenLanguages,
    subtitle: filters.selectedSubtitleLanguages,
    special: filters.selectedSpecials
  };
  Object.entries(lists).forEach(([key, values]) => {
    values.forEach(value => params.append(key, value));
  });
  return params;
}

async function read<T>(path: string, params = new URLSearchParams()): Promise<T> {
  const query = params.toString();
  const response = await fetch(`${API}${path}${query ? `?${query}` : ''}`);
  if (!response.ok) throw new Error(`Cineville request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export const movieService = {
  getNowShowingMovies: (city: string | null): Promise<Movie[]> =>
    read('/now-showing', new URLSearchParams(city ? { city } : {})),

  getUpcomingMovies: (): Promise<Movie[]> => read('/upcoming-films'),

  getAvailableLanguages: async (): Promise<{ subtitleLanguages: string[] }> => ({
    subtitleLanguages: ['en']
  }),

  getAvailableSpecials: (filters?: MovieFilters): Promise<{ specials: string[] }> =>
    read('/specials', screeningParams(filters)),

  getTheaters: (): Promise<City[]> => read('/cinemas'),

  getPopularMovies: (filters?: MovieFilters, includePosterless = false): Promise<MovieResponse> => {
    const params = screeningParams(filters);
    if (includePosterless) params.set('includePosterless', 'true');
    return read('/screenings', params);
  },

  getMovieShowtimes: (movieId: string, filters?: MovieFilters): Promise<Movie | null> =>
    read(`/films/${encodeURIComponent(movieId)}/showtimes`, screeningParams(filters)),

  searchMovies: (query: string, filters?: MovieFilters): Promise<MovieResponse> => {
    const params = screeningParams(filters);
    params.set('query', query);
    return read('/screenings', params);
  }
};
