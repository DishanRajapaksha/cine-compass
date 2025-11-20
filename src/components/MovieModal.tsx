import React, { useEffect } from 'react';
import { Movie } from '../types/Movie';
import { Button } from './ui/button';

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
}

const fallbackImage = 'https://via.placeholder.com/300x450/333333/ffffff?text=No+Image';

const MovieModal: React.FC<MovieModalProps> = ({ movie, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getYear = (dateString: string) => {
    const dt = new Date(dateString);
    return Number.isNaN(dt.getTime()) ? '' : dt.getFullYear();
  };

  const spoken = movie.spokenLanguages || [];
  const subtitles = movie.availableSubtitles || [];
  const versions = movie.availableLanguageVersions || [];
  const specials = movie.availableSpecials || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3 top-3 h-10 w-10 rounded-full bg-white/80 text-slate-700 shadow hover:bg-white"
        >
          ✕
        </Button>

        <div className="grid gap-6 p-6 md:grid-cols-[260px,1fr] md:items-stretch lg:grid-cols-[300px,1fr]">
          <div className="flex items-stretch justify-center">
            <img
              src={movie.poster_path || fallbackImage}
              alt={movie.title}
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackImage;
              }}
              className="h-full w-full max-w-[360px] rounded-xl object-cover shadow-md"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{movie.title}</h2>
              <p className="mt-1 text-slate-600">
                {getYear(movie.release_date)}
                {movie.duration ? ` • ${movie.duration} min` : ''}
              </p>
            </div>

            {movie.directors.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-800">Director{movie.directors.length > 1 ? 's' : ''}</h3>
                <p className="mt-1 text-slate-700">{movie.directors.join(', ')}</p>
              </section>
            )}

            {movie.cast.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-800">Cast</h3>
                <p className="mt-1 text-slate-700">
                  {movie.cast.slice(0, 5).join(', ')}
                  {movie.cast.length > 5 ? '…' : ''}
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

            {movie.showtimes.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-800">Showtimes</h3>
                <div className="mt-2 space-y-3">
                  {movie.showtimes.map((showtime) => {
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

                    return (
                      <div
                        key={showtime.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">
                            {showtime.theaterName}
                          </p>
                          <p className="text-sm text-slate-600">
                            {showtime.theaterCity} • {formattedDate} at {formattedTime}
                          </p>
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
              </section>
            )}

            <section>
              <h3 className="text-lg font-semibold text-slate-800">Overview</h3>
              <p className="mt-1 leading-relaxed text-slate-700">
                {movie.overview || 'No overview available for this movie.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieModal;
