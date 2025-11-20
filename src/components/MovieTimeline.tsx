import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Movie } from '../types/Movie';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';

interface MovieTimelineProps {
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  selectedMovie?: Movie | null;
  loading?: boolean;
  onAddShowtime?: (movie: Movie, showtimeId: string) => void;
  savedShowtimeIds?: string[];
}

interface TimelineShowtime {
  startTime: string;
  endTime: string;
  theaterId: string;
  theaterName: string;
  showtimeId: string;
}

interface TimelineRow {
  movie: Movie;
  showtime: TimelineShowtime;
}

const fallbackPoster = 'https://via.placeholder.com/50x75?text=No+Image';
const TIMELINE_PREFS_KEY = 'cineville_timeline_prefs';
const TIMELINE_THEATER_ORDER_KEY = 'cineville_timeline_theater_order';

const MovieTimeline: React.FC<MovieTimelineProps> = ({
  movies,
  onMovieClick,
  selectedMovie,
  loading = false,
  onAddShowtime,
  savedShowtimeIds = []
}) => {
  const [availabilityMode, setAvailabilityMode] = useState<'highlight' | 'hide'>(() => {
    if (typeof window === 'undefined') return 'highlight';
    try {
      const stored = localStorage.getItem(TIMELINE_PREFS_KEY);
      if (!stored) return 'highlight';
      const parsed = JSON.parse(stored);
      return parsed?.availabilityMode === 'hide' ? 'hide' : 'highlight';
    } catch {
      return 'highlight';
    }
  });
  const [selectedAnchor, setSelectedAnchor] = useState<{ movieId: string; showtimeId: string } | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return 15;
    try {
      const stored = localStorage.getItem(TIMELINE_PREFS_KEY);
      if (!stored) return 15;
      const parsed = JSON.parse(stored);
      const value = Number(parsed?.bufferMinutes);
      return Number.isFinite(value) ? value : 15;
    } catch {
      return 15;
    }
  });
  const [hideSameMovie, setHideSameMovie] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(TIMELINE_PREFS_KEY);
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return Boolean(parsed?.hideSameMovie);
    } catch {
      return false;
    }
  });
  const [theaterOrder, setTheaterOrder] = useState<string[]>([]);
  const [draggingTheater, setDraggingTheater] = useState<string | null>(null);
  const prefsHydratedRef = useRef(false);
  const savedShowtimeSet = useMemo(() => new Set(savedShowtimeIds), [savedShowtimeIds]);

  const { theaters, timelineData } = useMemo(() => {
    const theaterMap = new Map<string, string>();
    movies.forEach(movie => {
      movie.showtimes.forEach(showtime => {
        theaterMap.set(showtime.theaterId, showtime.theaterName);
      });
    });

    const uniqueTheaters = Array.from(theaterMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const rows: TimelineRow[] = [];

    movies.forEach(movie => {
      movie.showtimes.forEach(showtime => {
        const startDate = new Date(showtime.startDate);
        const endDate = new Date(showtime.endDate);

        const startTime = startDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const endTime = endDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        });

        rows.push({
          movie,
          showtime: {
            startTime,
            endTime,
            theaterId: showtime.theaterId,
            theaterName: showtime.theaterName,
            showtimeId: showtime.id
          }
        });
      });
    });

    rows.sort((a, b) => {
      const aTime = a.movie.showtimes.find(st => st.id === a.showtime.showtimeId);
      const bTime = b.movie.showtimes.find(st => st.id === b.showtime.showtimeId);
      if (!aTime || !bTime) return 0;
      return new Date(aTime.startDate).getTime() - new Date(bTime.startDate).getTime();
    });

    return { theaters: uniqueTheaters, timelineData: rows };
  }, [movies]);

  // Hydrate theater order only once when theaters are available
  useEffect(() => {
    if (prefsHydratedRef.current) return;
    if (typeof window === 'undefined') return;
    if (theaters.length === 0) return;
    try {
      const direct = localStorage.getItem(TIMELINE_THEATER_ORDER_KEY);
      if (direct) {
        const parsed = JSON.parse(direct);
        if (Array.isArray(parsed)) {
          setTheaterOrder(parsed.filter(Boolean));
          prefsHydratedRef.current = true;
          return;
        }
      }
      const stored = localStorage.getItem(TIMELINE_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed?.theaterOrder)) {
          setTheaterOrder(parsed.theaterOrder.filter(Boolean));
          prefsHydratedRef.current = true;
          return;
        }
      }
    } catch {
      // ignore and fall back
    }
    setTheaterOrder(theaters.map(t => t.id));
    prefsHydratedRef.current = true;
  }, [theaters]);

  // Merge in any new theaters (e.g., when filters change)
  useEffect(() => {
    if (!prefsHydratedRef.current) return;
    if (theaters.length === 0) return;
    setTheaterOrder(prev => {
      const currentIds = theaters.map(t => t.id);
      if (prev.length === 0) return currentIds;
      const valid = prev.filter(id => currentIds.includes(id));
      const missing = currentIds.filter(id => !valid.includes(id));
      const next = valid.concat(missing);
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [theaters]);

  // Persist preferences after hydration
  useEffect(() => {
    if (!prefsHydratedRef.current) return;
    if (typeof window === 'undefined') return;
    const payload = {
      availabilityMode,
      bufferMinutes,
      hideSameMovie,
      theaterOrder
    };
    localStorage.setItem(TIMELINE_PREFS_KEY, JSON.stringify(payload));
    if (theaterOrder.length > 0) {
      localStorage.setItem(TIMELINE_THEATER_ORDER_KEY, JSON.stringify(theaterOrder));
    }
  }, [availabilityMode, bufferMinutes, hideSameMovie, theaterOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (theaters.length === 0) return;
    const payload = {
      availabilityMode,
      bufferMinutes,
      hideSameMovie,
      theaterOrder
    };
    localStorage.setItem(TIMELINE_PREFS_KEY, JSON.stringify(payload));
    if (theaterOrder.length > 0) {
      localStorage.setItem(TIMELINE_THEATER_ORDER_KEY, JSON.stringify(theaterOrder));
    }
  }, [availabilityMode, bufferMinutes, hideSameMovie, theaterOrder, theaters]);

  useEffect(() => {
    if (theaters.length === 0) return;
    setTheaterOrder(prev => {
      const currentIds = theaters.map(t => t.id);
      if (prev.length === 0) return currentIds;
      const valid = prev.filter(id => currentIds.includes(id));
      const missing = currentIds.filter(id => !valid.includes(id));
      const next = valid.concat(missing);
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [theaters]);

  const bufferTimeMs = useMemo(() => Math.max(0, bufferMinutes) * 60 * 1000, [bufferMinutes]);

  const selectedAnchorEnd = useMemo(() => {
    if (!selectedAnchor) return null;
    const movie = movies.find(m => m.id === selectedAnchor.movieId);
    const showtime = movie?.showtimes.find(st => st.id === selectedAnchor.showtimeId);
    return showtime ? new Date(showtime.endDate).getTime() : null;
  }, [movies, selectedAnchor]);

  const handleShowtimeClick = (movie: Movie, showtimeId: string) => {
    setSelectedAnchor(prev => {
      if (prev?.movieId === movie.id && prev.showtimeId === showtimeId) {
        return null;
      }
      return { movieId: movie.id, showtimeId };
    });
  };

  const orderedTheaters = useMemo(() => {
    const storedIds = theaterOrder.filter(id => theaters.some(t => t.id === id));
    const remaining = theaters.filter(t => !storedIds.includes(t.id)).map(t => t.id);
    const finalIds = [...storedIds, ...remaining];
    return finalIds
      .map(id => theaters.find(t => t.id === id))
      .filter(Boolean) as { id: string; name: string }[];
  }, [theaterOrder, theaters]);

  const handleTheaterDragStart = (id: string) => setDraggingTheater(id);
  const handleTheaterDrop = (targetId: string) => {
    if (!draggingTheater || draggingTheater === targetId) return;
    setTheaterOrder(prev => {
      const next = [...prev];
      const fromIndex = next.indexOf(draggingTheater);
      const toIndex = next.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingTheater);
      return next;
    });
    setDraggingTheater(null);
  };

  if (loading) {
    return (
      <div className="mt-0 rounded-xl border border-slate-200 bg-white/80 p-10 text-center shadow-sm backdrop-blur">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
          <p className="text-sm text-slate-600">Loading showtimes…</p>
        </div>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="mt-0 rounded-xl border border-slate-200 bg-white/80 p-10 text-center text-slate-600 shadow-sm backdrop-blur">
        No movies to display
      </div>
    );
  }

  return (
    <div className="mt-0 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
            <Button
              variant={availabilityMode === 'highlight' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAvailabilityMode('highlight')}
              className="rounded-md"
            >
              Highlight available
            </Button>
            <Button
              variant={availabilityMode === 'hide' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setAvailabilityMode('hide')}
              className="rounded-md"
            >
              Hide unavailable
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Travel buffer:
            <div className="w-24">
              <Input
                type="number"
                min={0}
                max={180}
                step={5}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value) || 0)}
                aria-label="Buffer minutes between movies"
              />
            </div>
            min
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox
              checked={hideSameMovie}
              onCheckedChange={() => setHideSameMovie(prev => !prev)}
              aria-label="Hide same movie showtimes after selection"
            />
            Hide other showtimes of this movie
          </label>
        </div>

      </div>

      <div className="mt-2 overflow-x-auto">
        <div
          className="grid min-w-[900px] gap-px rounded-lg border border-slate-200 bg-slate-200"
          style={{ gridTemplateColumns: `240px repeat(${orderedTheaters.length}, minmax(160px, 1fr))` }}
        >
          <div className="sticky left-0 top-0 z-30 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm">
            Movie
          </div>
          {orderedTheaters.map(theater => (
            <div
              key={theater.id}
              className="sticky top-0 z-20 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm"
              draggable
              onDragStart={() => handleTheaterDragStart(theater.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleTheaterDrop(theater.id)}
            >
              {theater.name}
            </div>
          ))}

          {timelineData.map(({ movie, showtime }) => {
            const isSelectedByModal = selectedMovie?.id === movie.id;
            const isAnchorShowtime = selectedAnchor?.movieId === movie.id && selectedAnchor.showtimeId === showtime.showtimeId;
            const isSaved = savedShowtimeSet.has(showtime.showtimeId);

            let isAvailableAfterSelected = false;
            let isBlockedBySelection = false;
            if (selectedAnchorEnd) {
              const currentShowtimeStart = new Date(
                movie.showtimes.find(st => st.id === showtime.showtimeId)?.startDate || ''
              ).getTime();

              isAvailableAfterSelected = currentShowtimeStart >= (selectedAnchorEnd + bufferTimeMs);
              isBlockedBySelection = !isAnchorShowtime && !isAvailableAfterSelected;
            }

            const hideSameMovieRow = hideSameMovie && selectedAnchor && movie.id === selectedAnchor.movieId && !isAnchorShowtime;
            const shouldHideRow = Boolean((availabilityMode === 'hide' && selectedAnchorEnd !== null && isBlockedBySelection) || hideSameMovieRow);

            if (shouldHideRow) {
              return null;
            }

            return (
              <React.Fragment key={`${movie.id}-${showtime.showtimeId}`}>
                <div
                  className="sticky left-0 z-10 flex cursor-pointer items-center gap-3 bg-white px-3 py-2 pr-3 shadow-[2px_0_6px_rgba(0,0,0,0.04)] transition hover:bg-slate-50"
                  onClick={() => onMovieClick(movie)}
                >
                  <img
                    src={movie.poster_path}
                    alt={movie.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = fallbackPoster;
                    }}
                    className="h-[75px] w-[50px] rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900" title={movie.title}>
                      {movie.title}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                      {movie.duration ? <span>{movie.duration} min</span> : null}
                    </div>
                  </div>
                </div>

                {orderedTheaters.map(theater => {
                  const hasShowtime = showtime.theaterId === theater.id;
                  const highlighted = availabilityMode === 'highlight' && isAvailableAfterSelected && hasShowtime;

                  return (
                    <div
                      key={`${movie.id}-${showtime.showtimeId}-${theater.id}`}
                      className={cn(
                        'flex min-h-[110px] flex-col items-center justify-center gap-2 bg-white px-3 py-3 transition duration-200',
                        highlighted && 'border-2 border-emerald-300 bg-emerald-50 shadow-sm',
                        hasShowtime && !highlighted && 'bg-indigo-50'
                      )}
                    >
                      {hasShowtime ? (
                        <div className="flex w-full max-w-[200px] flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleShowtimeClick(movie, showtime.showtimeId)}
                            className={cn(
                              'w-full rounded-full px-4 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white',
                              isAnchorShowtime
                                ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600 focus:ring-amber-300'
                                : highlighted
                                  ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700 focus:ring-emerald-300'
                                  : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700 focus:ring-indigo-300',
                              isSelectedByModal && 'ring-2 ring-amber-200 ring-offset-2 ring-offset-white'
                            )}
                          >
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-bold">{showtime.startTime}</span>
                              <span className="text-[11px] font-medium text-white/80">ends {showtime.endTime}</span>
                            </div>
                          </button>
                          {onAddShowtime && (
                            <Button
                              type="button"
                              variant={isSaved ? 'secondary' : 'outline'}
                              size="sm"
                              className="w-full text-xs font-semibold"
                              disabled={isSaved}
                              onClick={() => onAddShowtime(movie, showtime.showtimeId)}
                            >
                              {isSaved ? 'Added to list' : 'Add to list'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300">—</div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MovieTimeline;
