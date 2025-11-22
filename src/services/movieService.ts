import { GraphQLClient, gql } from 'graphql-request';
import {
  Movie,
  MovieResponse,
  CinevilleResponse,
  CinevilleFilm,
  CinevilleTheater,
  CinevilleTheatersResponse,
  Theater,
  City,
  MovieFilters
} from '../types/Movie';

const CINEVILLE_API_URL = 'https://next.cineville.nl/api/graphql';

// Create a GraphQL client
const client = new GraphQLClient(CINEVILLE_API_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});

// GraphQL Queries using gql template tag
const THEATERS_QUERY = gql`
  query theaters($page: CursorPagination) {
    theaters(page: $page) {
      data {
        id
        name
        slug
        address {
          city
          country
        }
      }
    }
  }
`;

const SHOWTIMES_QUERY = gql`
  query showtimes(
    $filters: ShowtimesFilters
    $collections: [CollectionFilter!]
    $page: CursorPagination
    $sort: ShowtimesSort
    $locale: String
    $fallbackLocale: String
    $country: String
  ) {
    __typename
    showtimes(
      filters: $filters
      collections: $collections
      page: $page
      sort: $sort
      locale: $locale
      fallbackLocale: $fallbackLocale
      country: $country
    ) {
      __typename
      count
      totalCount
      data {
        __typename
        ...showtime
      }
      ...pageInfo
    }
  }

  fragment asset on Asset {
    __typename
    url
    mime
    alternativeText
  }

  fragment filmHighlight on FilmHighlight {
    __typename
    type
    author
    endDate
    startDate
    description
    label
    active
  }

  fragment film on Film {
    __typename
    id
    slug
    title
    cover {
      __typename
      ...asset
    }
    poster {
      __typename
      ...asset
    }
    trailer {
      __typename
      ...asset
    }
    cast
    duration
    directors
    releaseYear
    spokenLanguages
    contentRatingMinimumAge
    premiereDate
    highlights {
      __typename
      ...filmHighlight
    }
    defaultHighlight
    shortDescription
    description
    editorsNote
  }

  fragment address on Address {
    __typename
    street
    houseNumber
    postalCode
    city
    country
  }

  fragment theater on Theater {
    __typename
    id
    slug
    name
    address {
      __typename
      ...address
    }
    cover {
      __typename
      ...asset
    }
    website
    shortDescription
    intro
    description
    ticketInfo
  }

  fragment showtime on Showtime {
    __typename
    id
    film {
      __typename
      ...film
    }
    theater {
      __typename
      ...theater
    }
    startDate
    endDate
    subtitles
    subtitlesList
    languageVersion
    languageVersionAbbreviation
    ticketingUrl
    specials
  }

  fragment pageInfo on ListResponse {
    __typename
    count
    totalCount
    previous
    next
  }
`;

// Convert Cineville film data to our Movie interface
const convertCinevilleFilmToMovie = (film: CinevilleFilm, showtimes: any[]): Movie => {
  // No rating provided by the API yet
  const rating = 0;

  // Extract unique subtitle and language version options from showtimes
  const availableSubtitles = Array.from(new Set(
    showtimes
      .map(showtime => showtime.subtitles || '')
      .filter(subtitle => subtitle.trim())
      .map(subtitle => subtitle.trim())
  ));

  const availableLanguageVersions = Array.from(new Set(
    showtimes
      .filter(showtime => showtime.languageVersion && showtime.languageVersion.trim())
      .map(showtime => showtime.languageVersion.trim())
  ));

  const availableSpecials = Array.from(new Set(
    showtimes
      .map(showtime => showtime.specials || '')
      .filter(special => special.trim())
      .map(special => special.trim())
  ));

  // Convert showtimes to our format
  const movieShowtimes = showtimes.map(showtime => ({
    id: showtime.id,
    startDate: showtime.startDate,
    endDate: showtime.endDate,
    theaterId: showtime.theater.id,
    theaterName: showtime.theater.name,
    theaterCity: showtime.theater.address.city,
    ticketingUrl: showtime.ticketingUrl,
    specials: showtime.specials,
    subtitles: showtime.subtitles,
    languageVersion: showtime.languageVersion
  }));

  return {
    id: film.id,
    title: film.title,
    poster_path: film.poster?.url || film.cover?.url || '',
    release_date: film.premiereDate || `${film.releaseYear}-01-01`,
    overview: film.shortDescription || film.description || 'No description available.',
    vote_average: Math.round(rating * 10) / 10,
    genre_ids: [], // Cineville doesn't provide genre IDs in this format
    duration: film.duration,
    directors: film.directors || [],
    cast: film.cast || [],
    releaseYear: film.releaseYear,
    spokenLanguages: (film.spokenLanguages || []).filter(lang => lang !== null && lang.trim()),
    availableSubtitles,
    availableLanguageVersions,
    availableSpecials,
    showtimes: movieShowtimes
  };
};

// Get date range for API call based on filters or default
const getDateRange = (filters?: MovieFilters) => {
  const now = new Date();

  let startDate: Date;
  let endDate: Date;

  if (filters?.startDate) {
    startDate = new Date(filters.startDate);
    // Apply start time if provided
    if (filters.startTime) {
      const [hours, minutes] = filters.startTime.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }
  } else {
    // Use current time as default start
    startDate = new Date(now);
  }

  if (filters?.endDate) {
    endDate = new Date(filters.endDate);
    // Apply end time if provided
    if (filters.endTime) {
      const [hours, minutes] = filters.endTime.split(':').map(Number);
      endDate.setHours(hours, minutes, 59, 999);
    } else {
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // Use end of current day as default
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  return {
    gte: startDate.toISOString(),
    lt: endDate.toISOString()
  };
};

// Cache for all theater IDs to avoid repeated API calls
let allTheaterIdsCache: string[] | null = null;
let theatersCache: CinevilleTheater[] | null = null;
const cityTheaterIdsCache = new Map<string, string[]>();

// Load theaters once and reuse across helpers
const loadTheaters = async (): Promise<CinevilleTheater[]> => {
  if (theatersCache) {
    return theatersCache;
  }

  try {
    const response = await client.request<{ theaters: CinevilleTheatersResponse['data']['theaters'] }>(THEATERS_QUERY, {
      page: {
        limit: 999
      }
    });

    theatersCache = response.theaters.data;
    return theatersCache;
  } catch (error) {
    console.error('Error fetching theaters:', error);
    return [];
  }
};

// Helper function to get all theater IDs
const getAllTheaterIds = async (): Promise<string[]> => {
  if (allTheaterIdsCache) {
    return allTheaterIdsCache;
  }

  const theaters = await loadTheaters();
  allTheaterIdsCache = theaters.map(theater => theater.id);
  return allTheaterIdsCache;
};

// Helper function to get theater IDs by city
const getTheaterIdsByCity = async (cityName: string): Promise<string[]> => {
  if (cityTheaterIdsCache.has(cityName)) {
    return cityTheaterIdsCache.get(cityName)!;
  }

  const theaters = await loadTheaters();
  const theaterIds = theaters
    .filter(theater => theater.address.city === cityName)
    .map(theater => theater.id);

  cityTheaterIdsCache.set(cityName, theaterIds);
  return theaterIds;
};

const resolveVenueIds = async (filters?: MovieFilters): Promise<string[]> => {
  if (filters?.selectedTheaters?.length) {
    return filters.selectedTheaters;
  }

  if (filters?.selectedCity) {
    return getTheaterIdsByCity(filters.selectedCity);
  }

  return getAllTheaterIds();
};

type BuildApiFiltersOptions = {
  includeSubtitleFilter?: boolean;
};

const buildApiFilters = async (filters?: MovieFilters, options: BuildApiFiltersOptions = {}) => {
  const dateRange = getDateRange(filters);

  const apiFilters: Record<string, unknown> = {
    startDate: dateRange,
    venue: {
      collections: []
    }
  };

  const venueIds = await resolveVenueIds(filters);
  if (venueIds.length > 0) {
    apiFilters.venueId = {
      in: venueIds
    };
  }

  if (options.includeSubtitleFilter && filters?.selectedSubtitleLanguages?.length) {
    apiFilters.subtitles = {
      contains: filters.selectedSubtitleLanguages
    };
  }

  return { apiFilters, dateRange };
};

export const movieService = {
  getAvailableLanguages: async (filters?: MovieFilters): Promise<{ subtitleLanguages: string[] }> => {
    return {
      subtitleLanguages: ['en']
    };
  },

  getAvailableSpecials: async (filters?: MovieFilters): Promise<{ specials: string[] }> => {
    try {
      const { apiFilters } = await buildApiFilters(filters);

      const response = await client.request<{ showtimes: CinevilleResponse['data']['showtimes'] }>(SHOWTIMES_QUERY, {
        collections: [],
        country: 'NL',
        fallbackLocale: 'nl-NL',
        filters: apiFilters,
        locale: 'en-GB',
        page: {
          limit: 999
        }
      });

      // Extract unique specials from all showtimes
      const specialsSet = new Set<string>();
      response.showtimes.data.forEach(showtime => {
        if (showtime.specials && showtime.specials.trim()) {
          specialsSet.add(showtime.specials.trim());
        }
      });

      return {
        specials: Array.from(specialsSet).sort()
      };
    } catch (error) {
      console.error('Error fetching specials from Cineville API:', error);
      return {
        specials: []
      };
    }
  },

  getTheaters: async (): Promise<City[]> => {
    try {
      const theaters = await loadTheaters();

      // Group theaters by city
      const theatersByCity = new Map<string, Theater[]>();

      theaters.forEach(theater => {
        const city = theater.address.city;
        if (!theatersByCity.has(city)) {
          theatersByCity.set(city, []);
        }
        theatersByCity.get(city)!.push({
          id: theater.id,
          name: theater.name,
          city: city
        });
      });

      // Convert to City array and sort
      const cities: City[] = Array.from(theatersByCity.entries())
        .map(([cityName, theaters]) => ({
          name: cityName,
          theaters: theaters.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return cities;
    } catch (error) {
      console.error('Error fetching theaters from Cineville API:', error);
      throw new Error('Failed to fetch theaters');
    }
  },

  getPopularMovies: async (filters?: MovieFilters): Promise<MovieResponse> => {
    try {
      const { apiFilters } = await buildApiFilters(filters, { includeSubtitleFilter: true });

      const response = await client.request<{ showtimes: CinevilleResponse['data']['showtimes'] }>(SHOWTIMES_QUERY, {
        collections: [],
        country: 'NL',
        fallbackLocale: 'nl-NL',
        filters: apiFilters,
        locale: 'en-GB',
        page: {
          limit: 999
        }
      });

      // Extract unique films from showtimes and group showtimes by film
      const filmShowtimes = new Map<string, { film: CinevilleFilm; showtimes: any[] }>();

      // Filter showtimes based on specials if selected
      const shouldFilterBySpecials = (filters?.selectedSpecials?.length ?? 0) > 0;

      response.showtimes.data.forEach(showtime => {
        // If specials filter is active, only include showtimes that match
        if (shouldFilterBySpecials && filters) {
          const showtimeSpecials = showtime.specials?.toLowerCase() || '';
          const hasMatchingSpecial = filters.selectedSpecials.some(selectedSpecial =>
            showtimeSpecials.includes(selectedSpecial.toLowerCase())
          );
          if (!hasMatchingSpecial) {
            return; // Skip this showtime
          }
        }

        if (!filmShowtimes.has(showtime.film.id)) {
          filmShowtimes.set(showtime.film.id, {
            film: showtime.film,
            showtimes: []
          });
        }
        filmShowtimes.get(showtime.film.id)!.showtimes.push(showtime);
      });

      let movies = Array.from(filmShowtimes.values())
        .map(({ film, showtimes }) => convertCinevilleFilmToMovie(film, showtimes))
        .filter(movie => movie.poster_path); // Only include movies with posters

      // Apply subtitle language filter if specified
      if (filters?.selectedSubtitleLanguages?.length) {
        movies = movies.filter(movie => {
          // Check if the movie has any of the selected subtitle languages
          return filters.selectedSubtitleLanguages.some(selectedLang =>
            movie.availableSubtitles.some(availableSubtitle =>
              availableSubtitle.toLowerCase().includes(selectedLang.toLowerCase())
            )
          );
        });
      }

      if (filters?.selectedSpokenLanguages?.length) {
        movies = movies.filter(movie => {
          return filters.selectedSpokenLanguages.some(selectedLang =>
            movie.spokenLanguages.some(lang =>
              lang.toLowerCase().includes(selectedLang.toLowerCase())
            )
          );
        });
      }

      return {
        page: 1,
        results: movies,
        total_pages: 1,
        total_results: movies.length
      };
    } catch (error) {
      console.error('Error fetching movies from Cineville API:', error);
      throw new Error('Failed to fetch movies');
    }
  },

  searchMovies: async (query: string, filters?: MovieFilters): Promise<MovieResponse> => {
    // For search, we'll get all movies first and then filter
    const allMovies = await movieService.getPopularMovies(filters);

    const filteredMovies = allMovies.results.filter(movie =>
      movie.title.toLowerCase().includes(query.toLowerCase()) ||
      movie.directors.some(director =>
        director.toLowerCase().includes(query.toLowerCase())
      ) ||
      movie.cast.some(actor =>
        actor.toLowerCase().includes(query.toLowerCase())
      )
    );

    return {
      page: 1,
      results: filteredMovies,
      total_pages: 1,
      total_results: filteredMovies.length
    };
  }
};
