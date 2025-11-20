// Cineville API types
export interface CinevilleAsset {
  __typename: string;
  url: string;
  mime: string | null;
  alternativeText: string | null;
}

export interface CinevilleAddress {
  __typename: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface CinevilleTheater {
  __typename: string;
  id: string;
  slug: string;
  name: string;
  address: CinevilleAddress;
  cover: CinevilleAsset | null;
  website: string | null;
  shortDescription: string | null;
  intro: string | null;
  description: string | null;
  ticketInfo: string | null;
}

export interface CinevilleTheatersResponse {
  data: {
    theaters: {
      data: CinevilleTheater[];
    };
  };
}

export interface CinevilleFilm {
  __typename: string;
  id: string;
  slug: string;
  title: string;
  cover: CinevilleAsset | null;
  poster: CinevilleAsset | null;
  trailer: CinevilleAsset | null;
  cast: string[] | null;
  duration: number;
  directors: string[] | null;
  releaseYear: number;
  spokenLanguages: string[] | null;
  contentRatingMinimumAge: number | null;
  premiereDate: string | null;
  shortDescription: string;
  description: string;
  editorsNote: string | null;
}

export interface CinevilleShowtime {
  __typename: string;
  id: string;
  film: CinevilleFilm;
  theater: CinevilleTheater;
  startDate: string;
  endDate: string;
  subtitles: string;
  languageVersion: string | null;
  ticketingUrl: string | null;
  specials: string | null;
}

export interface CinevilleResponse {
  data: {
    showtimes: {
      count: number;
      totalCount: number;
      data: CinevilleShowtime[];
    };
  };
}

// Our app's movie interface (adapted from Cineville data)
export interface Movie {
  id: string;
  title: string;
  poster_path: string;
  release_date: string;
  overview: string;
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
