import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Movie, City, MovieFilters, SavedShowtime } from '../types/Movie';
import { movieService } from '../services/movieService';
import MoviePoster from './MoviePoster';
import MovieModal from './MovieModal';
import MovieFiltersComponent from './MovieFilters';
import MovieTimeline from './MovieTimeline';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

const BackgroundLayer: React.FC<{ posterUrl?: string; isVisible: boolean }> = ({ posterUrl, isVisible }) => (
  <div
    className={cn(
      'absolute inset-0 bg-cover bg-center bg-no-repeat blur-[25px] saturate-[1.8] brightness-[1.2] contrast-[1.3] hue-rotate-[5deg] scale-[1.15] transition-opacity duration-700 ease-in-out',
      isVisible ? 'opacity-60' : 'opacity-0'
    )}
    style={{ backgroundImage: posterUrl ? `url(${posterUrl})` : undefined }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 via-50% to-black/40 mix-blend-multiply" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.05)_40%,transparent_70%)] mix-blend-overlay" />
  </div>
);

const fallbackPoster = 'https://via.placeholder.com/50x75?text=No+Image';
const SAVED_SHOWTIMES_KEY = 'cineville_saved_showtimes';

const SavedShowtimesPopup: React.FC<{
  open: boolean;
  onToggle: () => void;
  showtimes: SavedShowtime[];
  onRemove: (showtimeId: string) => void;
}> = ({ open, onToggle, showtimes, onRemove }) => (
  <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex max-w-full flex-col items-end sm:bottom-8 sm:right-8">
    <div className="pointer-events-auto">
      <Button
        variant="secondary"
        className="rounded-full shadow-md shadow-indigo-200"
        onClick={onToggle}
      >
        Watchlist ({showtimes.length})
      </Button>
    </div>
    {open && (
      <div className="pointer-events-auto mt-3 w-[min(420px,calc(100vw-2.5rem))] max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved showtimes</p>
            <p className="text-sm text-slate-600">Collect a few picks as you browse</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggle}
            aria-label="Close saved showtimes"
          >
            ×
          </Button>
        </div>
        <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {showtimes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Add showtimes from the timeline to see them here.
            </div>
          ) : (
            showtimes.map((entry) => {
              const start = new Date(entry.startDate);
              const end = new Date(entry.endDate);
              const dateLabel = start.toLocaleDateString('en-GB', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              });
              const timeLabel = start.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const endTimeLabel = end.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={entry.showtimeId}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <img
                    src={entry.posterPath || fallbackPoster}
                    alt={entry.movieTitle}
                    className="h-16 w-11 flex-none rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = fallbackPoster; }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{entry.movieTitle}</p>
                        <p className="text-xs text-slate-600">
                          {dateLabel} • {timeLabel} – {endTimeLabel}
                        </p>
                        <p className="text-xs text-slate-600">
                          {entry.theaterName}
                          {entry.theaterCity ? ` • ${entry.theaterCity}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.ticketingUrl && (
                          <Button
                            size="sm"
                            variant="link"
                            className="px-0 text-indigo-600"
                            onClick={() => entry.ticketingUrl && window.open(entry.ticketingUrl, '_blank')}
                          >
                            Tickets
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${entry.movieTitle} at ${entry.theaterName}`}
                          onClick={() => onRemove(entry.showtimeId)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    )}
  </div>
);

const MovieGallery: React.FC = () => {
  const FILTERS_STORAGE_KEY = 'cineville_filters';
  const FILTERS_PANEL_KEY = 'cineville_filters_open';
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [availableSpecials, setAvailableSpecials] = useState<{
    specials: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [theatersLoading, setTheatersLoading] = useState(true);
  const [specialsLoading, setSpecialsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [hoveredMovie, setHoveredMovie] = useState<Movie | null>(null);
  const [previousMovie, setPreviousMovie] = useState<Movie | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('timeline');
  const [savedShowtimes, setSavedShowtimes] = useState<SavedShowtime[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(SAVED_SHOWTIMES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && item.showtimeId && item.movieId && item.startDate)
        .map((item) => ({
          movieId: item.movieId,
          movieTitle: item.movieTitle,
          posterPath: item.posterPath || '',
          showtimeId: item.showtimeId,
          startDate: item.startDate,
          endDate: item.endDate,
          theaterId: item.theaterId,
          theaterName: item.theaterName,
          theaterCity: item.theaterCity || '',
          ticketingUrl: item.ticketingUrl ?? null
        }));
    } catch {
      return [];
    }
  });
  const [savedListOpen, setSavedListOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(FILTERS_PANEL_KEY);
    if (stored === null) return true;
    return stored === 'true';
  });
  // Helper function to get default dates - current day for both start and end
  const getDefaultDates = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    return {
      startDate: today,
      endDate: today
    };
  };

  const defaultDates = getDefaultDates();
  const loadStoredFilters = (): MovieFilters | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        selectedCity: parsed.selectedCity ?? 'Amsterdam',
        selectedTheaters: parsed.selectedTheaters ?? [],
        selectedSubtitleLanguages: parsed.selectedSubtitleLanguages ?? [],
        selectedSpokenLanguages: parsed.selectedSpokenLanguages ?? [],
        selectedSpecials: parsed.selectedSpecials ?? [],
        startTime: parsed.startTime ?? null,
        endTime: parsed.endTime ?? null,
        startDate: parsed.startDate ?? defaultDates.startDate,
        endDate: parsed.endDate ?? defaultDates.endDate
      };
    } catch (err) {
      console.warn('Failed to parse stored filters', err);
      return null;
    }
  };

  const [filters, setFilters] = useState<MovieFilters>(() => {
    return loadStoredFilters() || {
      selectedCity: 'Amsterdam',
      selectedTheaters: [],
      selectedSubtitleLanguages: [],
      selectedSpokenLanguages: [],
      selectedSpecials: [],
      startTime: null,
      endTime: null,
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate
    };
  });

  const loadTheaters = useCallback(async () => {
    try {
      setTheatersLoading(true);
      const theatersData = await movieService.getTheaters();
      setCities(theatersData);
    } catch (err) {
      console.error('Failed to load theaters:', err);
    } finally {
      setTheatersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheaters();
  }, [loadTheaters]);

  // Load movies and specials when filters change
  useEffect(() => {
    const loadData = async () => {
      try {
        setSpecialsLoading(true);
        setLoading(true);
        setError(null);

        const [specialsData, moviesResponse] = await Promise.all([
          movieService.getAvailableSpecials(filters),
          movieService.getPopularMovies(filters)
        ]);

        setAvailableSpecials(specialsData);
        setMovies(moviesResponse.results);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load movies. Please try again later.');
      } finally {
        setSpecialsLoading(false);
        setLoading(false);
      }
    };

    loadData();
  }, [filters]); // Only depend on filters, not the callback functions

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SAVED_SHOWTIMES_KEY, JSON.stringify(savedShowtimes));
  }, [savedShowtimes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FILTERS_PANEL_KEY, String(filtersOpen));
  }, [filtersOpen]);

  const handleMovieClick = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const handleMovieHover = useCallback((movie: Movie | null) => {
    if (movie && movie !== hoveredMovie) {
      setPreviousMovie(hoveredMovie);
      setHoveredMovie(movie);
    }
  }, [hoveredMovie]);

  const handleFiltersChange = useCallback((newFilters: MovieFilters) => {
    setFilters(newFilters);
  }, []);

  const savedShowtimeIds = useMemo(
    () => savedShowtimes.map((item) => item.showtimeId),
    [savedShowtimes]
  );

  const availableSpokenLanguages = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((movie) => {
      (movie.spokenLanguages || []).forEach((lang) => {
        if (lang && lang.trim()) {
          set.add(lang.trim());
        }
      });
    });
    filters.selectedSpokenLanguages.forEach((lang) => {
      if (lang && lang.trim()) {
        set.add(lang.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [movies, filters.selectedSpokenLanguages]);

  const handleAddShowtimeToList = useCallback((movie: Movie, showtimeId: string) => {
    const showtime = movie.showtimes.find((st) => st.id === showtimeId);
    if (!showtime) return;

    setSavedShowtimes((prev) => {
      if (prev.some((item) => item.showtimeId === showtimeId)) {
        return prev;
      }

      const next: SavedShowtime[] = [
        ...prev,
        {
          movieId: movie.id,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          showtimeId,
          startDate: showtime.startDate,
          endDate: showtime.endDate,
          theaterId: showtime.theaterId,
          theaterName: showtime.theaterName,
          theaterCity: showtime.theaterCity,
          ticketingUrl: showtime.ticketingUrl
        }
      ];

      next.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      return next;
    });
    setSavedListOpen(true);
  }, []);

  const handleRemoveSavedShowtime = useCallback((showtimeId: string) => {
    setSavedShowtimes((prev) => prev.filter((item) => item.showtimeId !== showtimeId));
  }, []);

  if (error) {
    return (
      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="text-center text-lg font-semibold text-red-600">{error}</div>
      </div>
    );
  }

  const renderGridContent = () => {
    if (loading) {
      return (
        <div className="mt-0 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="space-y-3">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (movies.length === 0) {
      return (
        <div className="my-10 rounded-xl border border-slate-200 bg-white/80 p-10 text-center text-slate-600 shadow-sm backdrop-blur">
          {filters.selectedCity || filters.selectedTheaters.length > 0
            ? 'No movies found for the selected filters. Try adjusting your selection.'
            : 'No movies available'
          }
        </div>
      );
    }

    return (
      <div className="mt-0 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {movies.map((movie) => (
          <MoviePoster
            key={movie.id}
            movie={movie}
            onClick={handleMovieClick}
            onHover={handleMovieHover}
          />
        ))}
      </div>
    );
  };

  const renderTimelineContent = () => (
    <div className="relative">
      <MovieTimeline
        movies={movies}
        onMovieClick={handleMovieClick}
        selectedMovie={selectedMovie}
        loading={loading}
        onAddShowtime={handleAddShowtimeToList}
        savedShowtimeIds={savedShowtimeIds}
      />
      <SavedShowtimesPopup
        open={savedListOpen}
        onToggle={() => setSavedListOpen((prev) => !prev)}
        showtimes={savedShowtimes}
        onRemove={handleRemoveSavedShowtime}
      />
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 -z-10">
        {previousMovie && (
          <BackgroundLayer
            posterUrl={previousMovie.poster_path}
            isVisible={previousMovie.id !== hoveredMovie?.id}
          />
        )}
        {hoveredMovie && (
          <BackgroundLayer
            posterUrl={hoveredMovie.poster_path}
            isVisible={true}
          />
        )}
      </div>
      <div className="relative z-10 min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="mb-1 text-left lg:hidden lg:pl-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-full px-5 transition-all',
                viewMode === 'grid' ? 'shadow-md shadow-indigo-200' : ''
              )}
            >
              <span role="img" aria-label="grid">🎬</span>
              Grid View
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'outline'}
              onClick={() => setViewMode('timeline')}
              className={cn(
                'rounded-full px-5 transition-all',
                viewMode === 'timeline' ? 'shadow-md shadow-indigo-200' : ''
              )}
            >
              <span role="img" aria-label="timeline">📅</span>
              Timeline View
            </Button>
            <div className="lg:hidden">
              <Button
                variant="secondary"
                onClick={() => setFiltersOpen(prev => !prev)}
                className="rounded-full px-5"
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
              >
                {filtersOpen ? 'Hide filters' : 'Show filters'}
              </Button>
            </div>
          </div>
        </header>
        <div className={cn(
          'grid gap-8 items-start',
          filtersOpen ? 'lg:grid-cols-[320px,1fr]' : 'lg:grid-cols-1'
        )}>
          {!filtersOpen && (
            <div
              className="fixed left-0 top-1/2 hidden h-24 w-3 -translate-y-1/2 transform cursor-pointer rounded-r-full bg-indigo-500/30 transition hover:bg-indigo-500/60 lg:block"
              onMouseEnter={() => setFiltersOpen(true)}
              aria-label="Reveal filters"
            />
          )}
          <aside
            id="filters-panel"
            className={cn(
              'rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2',
              filtersOpen ? 'block' : 'hidden'
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFiltersOpen(false)}
                className="rounded-full px-3 text-slate-700 hover:bg-slate-100"
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
              >
                Hide
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
                className="rounded-full px-4"
              >
                🎬 Grid
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                onClick={() => setViewMode('timeline')}
                className="rounded-full px-4"
              >
                📅 Timeline
              </Button>
            </div>
            <MovieFiltersComponent
              cities={cities}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              loading={theatersLoading}
              availableSpecials={availableSpecials || undefined}
              specialsLoading={specialsLoading}
              availableSpokenLanguages={availableSpokenLanguages}
            />
          </aside>

          <section className="min-w-0 self-start">
            {viewMode === 'timeline' ? renderTimelineContent() : renderGridContent()}
          </section>
        </div>

        {selectedMovie && (
          <MovieModal
            movie={selectedMovie}
            onClose={handleCloseModal}
          />
        )}
      </div>
    </>
  );
};

export default MovieGallery; 
