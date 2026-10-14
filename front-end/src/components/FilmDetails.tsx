import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { City, Movie, SavedShowtime } from '../types/Movie';
import { formatDuration, amsterdamDate, dateLabel, languageName, screeningTime, Screening } from '../lib/schedule';
import FilmDescription from './FilmDescription';
import FilmShowtimes from './FilmShowtimes';
import ImdbLink from './ImdbLink';

export default function FilmDetails({ movie, releaseLabel, initialShowtimesOpen = false, screening, cities, city, saved, onSave, onPlan, onClose, onHide, filmSaved, onToggleFilm }: { filmSaved: boolean; onToggleFilm: () => void; onHide: () => void; movie:Movie;releaseLabel?:string;initialShowtimesOpen?:boolean;screening?: Screening; cities: City[]; city: string | null; saved: SavedShowtime[]; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void; onClose: () => void }) {
  const showtime = screening?.showtime;
  const [showtimesOpen, setShowtimesOpen] = useState(initialShowtimesOpen);
  const [posterFailed, setPosterFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isSaved = saved.some(s => s.showtimeId === showtime?.id);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className={`cc-dialog cc-film-dialog ${showtimesOpen ? "cc-dialog-showtimes" : ""}`} onCancel={onClose} onClick={e => { if(e.target === e.currentTarget) onClose(); }} aria-labelledby="cc-detail-title">
    <button className="cc-dialog-close" aria-label="Close film details" onClick={onClose}><X size={22}/></button>
    <div className={`cc-detail-hero ${!movie.poster_path || posterFailed ? 'without-poster' : ''}`}>
      {movie.poster_path && !posterFailed && <div className="cc-detail-poster"><img src={movie.poster_path} alt={`${movie.title} poster`} onError={() => setPosterFailed(true)}/></div>}
      <div className="cc-detail-intro">
        <span className="cc-detail-eyebrow">{releaseLabel || (showtime ? `In the programme${showtime.specials ? ` · ${showtime.specials}` : ''}` : '')}</span>
        <h2 id="cc-detail-title">{movie.title}</h2>
        <p className="cc-detail-meta">{[movie.releaseYear || null,movie.duration ? formatDuration(movie.duration) : 'Duration not listed',movie.spokenLanguages.map(languageName).join(', ') || 'Language not listed'].filter(Boolean).join(' · ')}</p>
        <div className="cc-detail-links"><ImdbLink title={movie.title} year={movie.releaseYear}/><button className="cc-film-watchlist" aria-pressed={filmSaved} onClick={onToggleFilm}>{filmSaved ? 'Remove film from watchlist' : 'Save film to watchlist'}</button><button className="cc-hide-movie" onClick={onHide}>Hide this movie</button></div>
      </div>
      <div className="cc-detail-story">
        <FilmDescription key={`${movie.id}:${movie.overview}`} movie={movie}/>
        {(movie.directors.length > 0 || movie.cast.length > 0) && <dl className="cc-detail-credits">
          {movie.directors.length > 0 && <div><dt>Directed by</dt><dd>{movie.directors.join(', ')}</dd></div>}
          {movie.cast.length > 0 && <div><dt>Cast</dt><dd>{movie.cast.join(', ')}</dd></div>}
        </dl>}
      </div>
    </div>
    {screening && showtime && <section className="cc-detail-screening" aria-label="Selected screening">
      <div className="cc-detail-screening-info"><span className="cc-detail-eyebrow">Your screening · {dateLabel(amsterdamDate(showtime.startDate))}</span><div className="cc-detail-screening-line"><strong>{screeningTime(showtime.startDate)} – {screeningTime(showtime.endDate)}</strong><span>{showtime.theaterName} <small>{showtime.theaterCity}</small></span></div></div>
      <div className="cc-detail-actions"><button className="cc-primary" onClick={() => onPlan(screening)}>Plan my evening <ArrowRight size={16}/></button><button className="cc-text-button" aria-pressed={isSaved} onClick={() => onSave(screening)}>{isSaved ? 'Remove saved screening' : 'Save screening'}</button>{showtime.ticketingUrl && <a className="cc-text-button" href={showtime.ticketingUrl} target="_blank" rel="noopener noreferrer">Tickets ↗</a>}</div>
    </section>}
    <div className="cc-detail-showtimes-toggle"><button className="cc-text-button" aria-expanded={showtimesOpen} onClick={() => setShowtimesOpen(v => !v)}>{showtimesOpen ? 'Hide all showtimes' : 'All showtimes for this film'} <span aria-hidden="true">{showtimesOpen ? '−' : '+'}</span></button></div>
    {showtimesOpen && <FilmShowtimes movieId={movie.id} movieTitle={movie.title} cities={cities} initialCity={city} saved={saved} onSave={onSave} onPlan={onPlan}/>}
  </dialog>;
}

