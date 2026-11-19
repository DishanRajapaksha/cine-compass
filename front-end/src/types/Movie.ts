// Our app's movie interface (adapted from Cineville data)
export interface Movie {
  createdAt?: string;
  id: string;
  title: string;
  poster_path: string;
  release_date: string;
  overview: string;
  overviewLanguage?: 'en' | 'nl';
  vote_average: number;
  genre_ids: number[];
  duration: number;
  directors: string[];
  cast: string[];
  releaseYear: number;
  spokenLanguages: string[];
  availableSubtitles: string[];
  availableLanguageVersions: string[];
  availableSpecials: string[];
  showtimes: MovieShowtime[];
}

export interface MovieShowtime {
  id: string;
  startDate: string;
  endDate: string;
  theaterId: string;
  theaterName: string;
  theaterCity: string;
  ticketingUrl: string | null;
  specials: string | null;
  subtitles: string;
  languageVersion: string | null;
}

export interface SavedFilm {
  id: string;
  title: string;
  posterPath: string;
  year?: number;
  duration?: number;
  spokenLanguages?: string[];
  availableSubtitles?: string[];
  availableLanguageVersions?: string[];
  availableSpecials?: string[];
  releaseDate?: string;
  overview?: string;
  overviewLanguage?: 'en' | 'nl';
  directors?: string[];
  cast?: string[];
  createdAt?: string;
}

export interface MovieList {
  id: string;
  name: string;
  films: SavedFilm[];
  hideWatched?: boolean;
}

export interface WatchedMovie {
  id: string;
  title: string;
  year?: number;
}

export interface SavedShowtime {
  movieId: string;
  movieTitle: string;
  posterPath: string;
  showtimeId: string;
  startDate: string;
  endDate: string;
  theaterId: string;
  theaterName: string;
  theaterCity: string;
  ticketingUrl: string | null;
}

export interface MovieResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

// Filter types
export interface Theater {
  id: string;
  name: string;
  city: string;
}

export interface City {
  name: string;
  theaters: Theater[];
}

export interface LanguageFilterValues {
  languageMatchMode?: 'any' | 'all';
  selectedSubtitleLanguages: string[];
  selectedSpokenLanguages: string[];
}

export interface MovieFilters extends LanguageFilterValues {
  watchlistOnly?: boolean;
  selectedCity: string | null;
  selectedTheaters: string[];
  selectedSpecials: string[];
  startTime: string | null; // Format: "HH:MM"
  endTime: string | null;   // Format: "HH:MM"
  startDate: string | null; // Format: "YYYY-MM-DD"
  endDate: string | null;   // Format: "YYYY-MM-DD"
} 
