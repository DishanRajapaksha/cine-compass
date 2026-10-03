// Cineville API types
export interface CinevilleAsset {
  id: string;
  url: string;
  mimeType: string | null;
}

export interface CinevilleAddress {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface CinevilleTheater {
  id: string;
  slug: string;
  name: string;
  address: CinevilleAddress;
  assets: Record<string, CinevilleAsset | null>;
  attributes: Record<string, unknown>;
  localizableAttributes: Record<string, unknown>;
  isHidden: boolean;
}

export interface CinevilleFilm {
  id: string;
  slug: string;
  title: string;
  assets: Record<string, CinevilleAsset | null>;
  attributes: Record<string, unknown>;
  localizableAttributes: Record<string, unknown>;
}

export interface CinevilleShowtime {
  id: string;
  productionId: string | null;
  venueId: string;
  startDate: string;
  endDate: string | null;
  ticketingUrl: string | null;
  attributes: Record<string, unknown>;
  localizableAttributes: Record<string, unknown>;
  _embedded: {
    production?: CinevilleFilm;
    venue?: CinevilleTheater;
  };
}

export interface CinevilleResponse {
  count: number;
  totalCount: number;
  _links: {
    next?: { href: string };
  };
  _embedded: {
    events: CinevilleShowtime[];
  };
}

export interface CinevilleTheatersResponse {
  count: number;
  totalCount: number;
  _links: {
    next?: { href: string };
  };
  _embedded: {
    venues: CinevilleTheater[];
  };
}

// Our app's movie interface (adapted from Cineville data)
export interface Movie {
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
}

export interface HiddenMovie {
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

export interface MovieFilters {
  watchlistOnly?: boolean;
  languageMatchMode?: 'any' | 'all';
  selectedCity: string | null;
  selectedTheaters: string[];
  selectedSubtitleLanguages: string[];
  selectedSpokenLanguages: string[];
  selectedSpecials: string[];
  startTime: string | null; // Format: "HH:MM"
  endTime: string | null;   // Format: "HH:MM"
  startDate: string | null; // Format: "YYYY-MM-DD"
  endDate: string | null;   // Format: "YYYY-MM-DD"
} 
