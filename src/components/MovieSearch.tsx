import React, { useState, useCallback, useEffect } from 'react';
import { Movie, MovieFilters } from '../types/Movie';
import { movieService } from '../services/movieService';
import MoviePoster from './MoviePoster';
import { cn, getPosterDominantColor, hasEnglishSubtitles, type RgbColor } from '../lib/utils';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Search, X, ArrowLeft } from 'lucide-react';

interface MovieSearchProps {
    filters?: MovieFilters;
    onMovieHover?: (movie: Movie | null) => void;
}

const fallbackImage = 'https://via.placeholder.com/300x450/333333/ffffff?text=No+Image';

const MovieSearch: React.FC<MovieSearchProps> = ({ filters, onMovieHover }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [accentColor, setAccentColor] = useState<RgbColor | null>(null);
    const selectedPosterPath = selectedMovie?.poster_path || '';

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setMovies([]);
            setHasSearched(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setHasSearched(true);

            const response = await movieService.searchMovies(query, filters);
            setMovies(response.results);
        } catch (err) {
            console.error('Failed to search movies:', err);
            setError('Failed to search movies. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleSearch(searchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, handleSearch]);

    useEffect(() => {
        if (!selectedPosterPath) {
            setAccentColor(null);
            return;
        }

        let active = true;
        getPosterDominantColor(selectedPosterPath).then((color) => {
            if (active) {
                setAccentColor(color);
            }
        });

        return () => {
            active = false;
        };
    }, [selectedPosterPath]);

    const handleMovieClick = (movie: Movie) => {
        setSelectedMovie(movie);
    };

    const handleBackToResults = () => {
        setSelectedMovie(null);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setMovies([]);
        setHasSearched(false);
        setSelectedMovie(null);
    };

    const getYear = (dateString: string) => {
        const dt = new Date(dateString);
        return Number.isNaN(dt.getTime()) ? '' : dt.getFullYear();
    };

    // Render detailed movie view with showtimes
    const renderMovieDetails = () => {
        if (!selectedMovie) return null;

        const spoken = selectedMovie.spokenLanguages || [];
        const subtitles = selectedMovie.availableSubtitles || [];
        const versions = selectedMovie.availableLanguageVersions || [];
        const specials = selectedMovie.availableSpecials || [];

        return (
            <div className="space-y-6">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={handleBackToResults}
                    className="mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Search Results
                </Button>

                {/* Movie Details */}
                <div className="grid gap-6 md:grid-cols-[300px,1fr]">
                    {/* Poster */}
                    <div className="flex justify-center md:justify-start">
                        <img
                            src={selectedMovie.poster_path || fallbackImage}
                            alt={selectedMovie.title}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = fallbackImage;
                            }}
                            className="w-full max-w-[300px] rounded-xl object-cover shadow-lg"
                        />
                    </div>

                    {/* Info */}
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">{selectedMovie.title}</h2>
                            <p className="mt-1 text-lg text-slate-600">
                                {getYear(selectedMovie.release_date)}
                                {selectedMovie.duration ? ` • ${selectedMovie.duration} min` : ''}
                            </p>
                        </div>

                        {selectedMovie.directors.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">
                                    Director{selectedMovie.directors.length > 1 ? 's' : ''}
                                </h3>
                                <p className="mt-1 text-slate-700">{selectedMovie.directors.join(', ')}</p>
                            </section>
                        )}

                        {selectedMovie.cast.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">Cast</h3>
                                <p className="mt-1 text-slate-700">
                                    {selectedMovie.cast.slice(0, 5).join(', ')}
                                    {selectedMovie.cast.length > 5 ? '…' : ''}
                                </p>
                            </section>
                        )}

                        {spoken.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">Spoken Languages</h3>
                                <p className="mt-1 text-slate-700">{spoken.join(', ')}</p>
                            </section>
                        )}

                        {subtitles.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">Subtitle Languages</h3>
                                <p className="mt-1 text-slate-700">{subtitles.join(', ')}</p>
                            </section>
                        )}

                        {versions.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">Language Versions</h3>
                                <p className="mt-1 text-slate-700">{versions.join(', ')}</p>
                            </section>
                        )}

                        {specials.length > 0 && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800">Specials</h3>
                                <p className="mt-1 text-slate-700">{specials.join(', ')}</p>
                            </section>
                        )}

                        <section>
                            <h3 className="text-lg font-semibold text-slate-800">Overview</h3>
                            <p className="mt-1 leading-relaxed text-slate-700">
                                {selectedMovie.overview || 'No overview available for this movie.'}
                            </p>
                        </section>
                    </div>
                </div>

                {/* Showtimes Section */}
                <section className="mt-8">
                    <h3 className="mb-4 text-2xl font-bold text-slate-900">
                        Showtimes
                        {selectedMovie.showtimes.length > 0 && (
                            <span className="ml-2 text-lg font-normal text-slate-600">
                                ({selectedMovie.showtimes.length} showing{selectedMovie.showtimes.length !== 1 ? 's' : ''})
                            </span>
                        )}
                    </h3>

                    {selectedMovie.showtimes.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                            <p className="text-slate-600">
                                No showtimes available for the current filters.
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                Try adjusting your city, theater, or date filters in the sidebar.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedMovie.showtimes.map((showtime) => {
                                const startDate = new Date(showtime.startDate);
                                const formattedDate = startDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                });
                                const formattedTime = startDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                });
                                const showtimeHasEnglishSubtitles = hasEnglishSubtitles(showtime.subtitles);
                                const subtitleParts = (showtime.subtitles || '')
                                    .split(',')
                                    .map((part) => part.trim())
                                    .filter(Boolean);
                                const subtitlePartsWithoutEnglish = showtimeHasEnglishSubtitles
                                    ? subtitleParts.filter((part) => !hasEnglishSubtitles(part))
                                    : subtitleParts;
                                const subtitleText = subtitlePartsWithoutEnglish.length > 0
                                    ? subtitlePartsWithoutEnglish.join(', ')
                                    : null;
                                const accentRowStyle = accentColor
                                    ? {
                                        borderColor: `rgb(${accentColor.r}, ${accentColor.g}, ${accentColor.b})`,
                                        backgroundColor: `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.18)`,
                                        boxShadow: `0 0 0 2px rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.28)`
                                    }
                                    : undefined;
                                const accentBadgeStyle = accentColor
                                    ? { backgroundColor: `rgb(${accentColor.r}, ${accentColor.g}, ${accentColor.b})` }
                                    : undefined;

                                return (
                                    <div
                                        key={showtime.id}
                                        className={cn(
                                            'flex items-center justify-between rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md',
                                            showtimeHasEnglishSubtitles
                                                ? 'border-indigo-400 bg-indigo-100 ring-2 ring-indigo-200'
                                                : 'border-slate-200 bg-white'
                                        )}
                                        style={showtimeHasEnglishSubtitles ? accentRowStyle : undefined}
                                    >
                                        <div className="flex-1">
                                            <p className="flex items-center gap-2 font-semibold text-slate-900">
                                                <span>{showtime.theaterName}</span>
                                                {showtimeHasEnglishSubtitles && (
                                                    <span
                                                        className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                                                        style={accentBadgeStyle}
                                                    >
                                                        EN subtitles
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                {showtime.theaterCity} • {formattedDate} at {formattedTime}
                                            </p>
                                            {subtitleText && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Subtitles: {subtitleText}
                                                </p>
                                            )}
                                            {showtime.specials && (
                                                <p className="mt-1 text-xs text-indigo-600">
                                                    {showtime.specials}
                                                </p>
                                            )}
                                        </div>
                                        {showtime.ticketingUrl && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="ml-3"
                                                onClick={() => window.open(showtime.ticketingUrl!, '_blank')}
                                            >
                                                Book Tickets
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        );
    };

    const renderSearchResults = () => {
        if (loading) {
            return (
                <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

        if (!hasSearched) {
            return (
                <div className="mt-16 text-center">
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100">
                        <Search className="h-12 w-12 text-indigo-600" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-900">Search for Movies</h3>
                    <p className="text-slate-600">
                        Enter a movie title to find movies
                    </p>
                </div>
            );
        }

        if (movies.length === 0) {
            return (
                <div className="mt-16 text-center">
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100">
                        <Search className="h-12 w-12 text-slate-400" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-900">No Results Found</h3>
                    <p className="text-slate-600">
                        No movies found for "{searchQuery}". Try a different search term.
                    </p>
                </div>
            );
        }

        return (
            <div className="mt-8">
                <p className="mb-4 text-sm text-slate-600">
                    Found {movies.length} {movies.length === 1 ? 'movie' : 'movies'} for "{searchQuery}"
                </p>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {movies.map((movie) => (
                        <MoviePoster
                            key={movie.id}
                            movie={movie}
                            onClick={handleMovieClick}
                            onHover={onMovieHover}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            {/* Show search header only when not viewing movie details */}
            {!selectedMovie && (
                <>
                    {/* Search Header */}
                    <div className="mb-6">
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Search Movies</h2>

                        {/* Search Input */}
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title..."
                                className={cn(
                                    'w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-12 pr-12 text-slate-900 placeholder-slate-400 transition-all',
                                    'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200',
                                    'hover:border-slate-300'
                                )}
                            />
                            {searchQuery && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                                    aria-label="Clear search"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {/* Search Tips */}
                        {!hasSearched && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="text-xs text-slate-500">Try searching for:</span>
                                {['Dune', 'Oppenheimer', 'Barbie'].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setSearchQuery(suggestion)}
                                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                            {error}
                        </div>
                    )}
                </>
            )}

            {/* Content */}
            {selectedMovie ? renderMovieDetails() : renderSearchResults()}
        </div>
    );
};

export default MovieSearch;
