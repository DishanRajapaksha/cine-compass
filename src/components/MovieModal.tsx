import React, { useEffect, useMemo, useState } from 'react';
import { Movie } from '../types/Movie';
import { Button } from './ui/button';
import { cn, getPosterDominantColor, hasEnglishSubtitles, type RgbColor } from '../lib/utils';

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
}

const fallbackImage = 'https://via.placeholder.com/300x450/333333/ffffff?text=No+Image';

const MovieModal: React.FC<MovieModalProps> = ({ movie, onClose }) => {
  const [accentColor, setAccentColor] = useState<RgbColor | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    getPosterDominantColor(movie.poster_path).then((color) => {
      if (active) {
        setAccentColor(color);
      }
    });

    return () => {
      active = false;
    };
  }, [movie.poster_path]);

  const accentStyles = useMemo(() => {
    if (!accentColor) return null;
    const base = `rgb(${accentColor.r}, ${accentColor.g}, ${accentColor.b})`;
    return {
      row: {
        borderColor: base,
        backgroundColor: `rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.18)`,
        boxShadow: `0 0 0 2px rgba(${accentColor.r}, ${accentColor.g}, ${accentColor.b}, 0.28)`
      } as React.CSSProperties,
      badge: {
        backgroundColor: base
      } as React.CSSProperties
    };
  }, [accentColor]);

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
  const versions = movie.availableLanguageVersions || [];
  const specials = movie.availableSpecials || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3 top-3 h-10 w-10 rounded-full bg-white/80 text-slate-700 shadow hover:bg-white"
        >
          ✕
        </Button>

        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
          <div className="grid gap-6 p-6 lg:h-full lg:min-h-0 lg:grid-cols-[320px,minmax(0,1fr)] lg:grid-rows-1">
            <aside className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:min-h-0 lg:max-h-full lg:overflow-y-auto">
              <div className="mx-auto w-full max-w-[280px]">
                <img
                  src={movie.poster_path || fallbackImage}
                  alt={movie.title}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackImage;
                  }}
                  className="h-auto w-full rounded-xl object-cover shadow-md"
                />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">{movie.title}</h2>
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
                  {movie.overview || 'No overview available for this movie.'}
                </p>
              </section>
            </aside>

            <section className="lg:min-h-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <h3 className="text-lg font-semibold text-slate-800">Showtimes</h3>

                {movie.showtimes.length > 0 ? (
                  <div className="mt-2 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
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
                      const showtimeHasEnglishSubtitles = hasEnglishSubtitles(showtime.subtitles);
                      const subtitleParts = (showtime.subtitles || '')
                        .split(',')
                        .map((part) => part.trim())
                        .filter(Boolean);
                      const subtitlePartsWithoutEnglish = showtimeHasEnglishSubtitles
                        ? subtitleParts.filter((part) => !hasEnglishSubtitles(part))
                        : subtitleParts;
                      const subtitleText = subtitlePartsWithoutEnglish.length > 0
                        ? `Subtitles: ${subtitlePartsWithoutEnglish.join(', ')}`
                        : null;
                      const metadataItems = [
                        subtitleText,
                        showtime.languageVersion ? `Version: ${showtime.languageVersion}` : null,
                        showtime.specials ? `Special: ${showtime.specials}` : null
                      ].filter(Boolean);

                      return (
                        <div
                          key={showtime.id}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-lg border p-3',
                            showtimeHasEnglishSubtitles
                              ? 'border-indigo-400 bg-indigo-100 ring-2 ring-indigo-200'
                              : 'border-slate-200 bg-slate-50'
                          )}
                          style={showtimeHasEnglishSubtitles && accentStyles ? accentStyles.row : undefined}
                        >
                          <div className="flex-1">
                            <p className="flex items-center gap-2 font-semibold text-slate-900">
                              <span>{showtime.theaterName}</span>
                              {showtimeHasEnglishSubtitles && (
                                <span
                                  className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                                  style={accentStyles?.badge}
                                >
                                  EN subtitles
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-slate-600">
                              {showtime.theaterCity} • {formattedDate} at {formattedTime}
                            </p>
                            {metadataItems.length > 0 && (
                              <p className="mt-1 text-xs text-slate-500">
                                {metadataItems.join(' • ')}
                              </p>
                            )}
                          </div>
                          {showtime.ticketingUrl && (
                            <Button
                              variant="default"
                              size="sm"
                              className="ml-3 shrink-0"
                              onClick={() => window.open(showtime.ticketingUrl!, '_blank')}
                            >
                              Book Tickets
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-slate-600">No showtimes available right now.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieModal;
