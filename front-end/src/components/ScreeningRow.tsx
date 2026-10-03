import React, { useId, useState } from 'react';
import { Bookmark, Check, ExternalLink, EyeOff, CalendarPlus, Calendar, Ticket, MoreHorizontal } from 'lucide-react';
import { Screening, languageName, screeningTime } from '../lib/schedule';
import { hasEnglishSubtitles } from '../lib/utils';
import ImdbLink from './ImdbLink';
export const plainDescription = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};
export default function ScreeningRow({ screening: {movie, showtime}, compact, saved, selected, unavailable, available, onSave, onSelect, onDetails, onHide, onPlan, filmSaved, onToggleFilm }: {
  filmSaved?: boolean; onToggleFilm?: () => void; screening: Screening; compact: boolean; saved: boolean; selected: boolean; unavailable: boolean; available?: boolean;
  onSave: () => void; onSelect: () => void; onDetails: () => void; onHide?: () => void; onPlan?: () => void;
}) {
  const [moreOpen,setMoreOpen] = useState(false);
  const moreId = useId();
  const spoken = movie.spokenLanguages.map(languageName).join(', ') || 'Language not listed';
  const subtitles = hasEnglishSubtitles(showtime.subtitles) ? 'English subtitles' : showtime.subtitles ? `${showtime.subtitles} subtitles` : 'Subtitles not listed';
  return <article className={`cc-screening ${compact ? 'is-compact' : ''} ${selected ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''} ${available ? 'is-available' : ''}`} aria-label={`${movie.title} at ${screeningTime(showtime.startDate)}, ${showtime.theaterName}`}>
    {!compact && <button className="cc-poster-button" onClick={onDetails} aria-label={`Details for ${movie.title}`}>{movie.poster_path ? <img loading="lazy" src={movie.poster_path} alt={movie.title} onError={e => { e.currentTarget.style.display='none'; }}/> : <span className="cc-poster-missing">{movie.title}</span>}</button>}
    <button className="cc-screening-time" onClick={onSelect} aria-pressed={selected} title="Select as the starting point for your evening"><strong>{screeningTime(showtime.startDate)}</strong><strong>{screeningTime(showtime.endDate)}</strong>{selected && <small>Your starting point</small>}{available && <small>Available after your pick</small>}</button>
    <div className="cc-film"><button className="cc-title" onClick={onDetails}>{movie.title}</button><div className="cc-film-meta">{movie.duration ? `${movie.duration} min` : 'Duration not listed'}{movie.releaseYear ? ` · ${movie.releaseYear}` : ''}<span> · {spoken}</span><span className={`cc-subtitle-meta ${hasEnglishSubtitles(showtime.subtitles) ? 'cc-english' : ''}`}><span className="cc-meta-separator"> · </span>{subtitles}</span>{showtime.languageVersion && <span> · {showtime.languageVersion}</span>}</div>{!compact && <p className="cc-synopsis">{plainDescription(movie.overview)}</p>}{showtime.specials && <span className="cc-special">{showtime.specials}</span>}</div>
    <div className="cc-venue"><strong>{showtime.theaterName}</strong><span>{showtime.theaterCity}</span></div>
    <div className="cc-screening-footer">
      <div className="cc-screening-actions">
        {!compact && <>
        <ImdbLink title={movie.title} year={movie.releaseYear}/>
        {onToggleFilm && <button className="cc-film-watchlist" aria-label={`${filmSaved ? 'Remove' : 'Save'} film ${movie.title} ${filmSaved ? 'from' : 'to'} watchlist`} aria-pressed={Boolean(filmSaved)} onClick={onToggleFilm}><Bookmark size={13} fill={filmSaved ? 'currentColor' : 'none'}/><span className="cc-action-label">{filmSaved ? 'On watchlist' : 'Watchlist'}</span></button>}
        {onHide && <button className="cc-hide-movie cc-mobile-secondary" onClick={onHide} aria-label={`Hide ${movie.title} permanently`} title="Hide all screenings until restored in Settings"><EyeOff size={13}/><span className="cc-action-label">Hide</span></button>}
        {showtime.ticketingUrl && <a href={showtime.ticketingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Tickets for ${movie.title}`} title="Tickets (opens in a new tab)"><Ticket size={14}/><span className="cc-action-label">Tickets</span><ExternalLink className="cc-action-label" size={13}/></a>}
        <button title={saved ? 'Remove saved screening' : 'Save screening'} className={`cc-screening-save ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Remove' : 'Save'} ${movie.title} at ${screeningTime(showtime.startDate)}`} aria-pressed={saved}>{saved ? <Check size={14}/> : <Calendar size={14}/>}<span className="cc-action-label">{saved ? 'Screening saved' : 'Save screening'}</span></button>
        {onPlan && <button className="cc-screening-plan cc-mobile-secondary" onClick={onPlan} aria-pressed={selected} aria-label={`Plan my evening after ${movie.title} at ${screeningTime(showtime.startDate)}`} title="Plan my evening"><CalendarPlus size={14}/><span className="cc-action-label">Plan my evening</span></button>}
        </>}
        <button className="cc-mobile-more" aria-label={`More actions for ${movie.title} at ${screeningTime(showtime.startDate)}`} aria-expanded={moreOpen} aria-controls={moreId} onClick={() => setMoreOpen(v => !v)} title="More actions"><MoreHorizontal size={20}/></button>
      </div>
      {moreOpen && <div className="cc-screening-more" id={moreId} role="group" aria-label={`More actions for ${movie.title}`}>
        {compact && <>
          <ImdbLink title={movie.title} year={movie.releaseYear}/>
          {onToggleFilm && <button aria-label={`${filmSaved ? 'Remove' : 'Save'} film ${movie.title} ${filmSaved ? 'from' : 'to'} watchlist`} aria-pressed={Boolean(filmSaved)} onClick={() => {setMoreOpen(false);onToggleFilm();}}><Bookmark size={16} fill={filmSaved ? 'currentColor' : 'none'}/> {filmSaved ? 'Remove film from watchlist' : 'Save film to watchlist'}</button>}
          {showtime.ticketingUrl && <a href={showtime.ticketingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Tickets for ${movie.title}`}><Ticket size={16}/> Tickets <ExternalLink size={13}/></a>}
          <button aria-label={`${saved ? 'Remove' : 'Save'} ${movie.title} at ${screeningTime(showtime.startDate)}`} aria-pressed={saved} onClick={() => {setMoreOpen(false);onSave();}}>{saved ? <Check size={16}/> : <Calendar size={16}/>} {saved ? 'Remove saved screening' : 'Save screening'}</button>
        </>}
        {onHide && <button onClick={() => {setMoreOpen(false);onHide();}}><EyeOff size={16}/> Hide this film</button>}
        {onPlan && <button aria-label={compact ? `Plan my evening after ${movie.title} at ${screeningTime(showtime.startDate)}` : undefined} aria-pressed={selected} onClick={() => {setMoreOpen(false);onPlan();}}><CalendarPlus size={16}/> Plan my evening</button>}
      </div>}
    </div>
  </article>;
}
