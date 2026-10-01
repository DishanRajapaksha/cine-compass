import React from 'react';
import { Bookmark, Check, ExternalLink, EyeOff, ArrowRight } from 'lucide-react';
import { Screening, languageName, screeningTime } from '../lib/schedule';
import { hasEnglishSubtitles } from '../lib/utils';
import ImdbLink from './ImdbLink';
export const plainDescription = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};
export default function ScreeningRow({ screening: {movie, showtime}, compact, saved, selected, unavailable, available, onSave, onSelect, onDetails, onHide, onPlan }: {
  screening: Screening; compact: boolean; saved: boolean; selected: boolean; unavailable: boolean; available?: boolean;
  onSave: () => void; onSelect: () => void; onDetails: () => void; onHide?: () => void; onPlan?: () => void;
}) {
  const spoken = movie.spokenLanguages.map(languageName).join(', ') || 'Language not listed';
  const subtitles = hasEnglishSubtitles(showtime.subtitles) ? 'English subtitles' : showtime.subtitles ? `${showtime.subtitles} subtitles` : 'Subtitles not listed';
  return <article className={`cc-screening ${compact ? 'is-compact' : ''} ${selected ? 'is-selected' : ''} ${unavailable ? 'is-unavailable' : ''} ${available ? 'is-available' : ''}`} aria-label={`${movie.title} at ${screeningTime(showtime.startDate)}, ${showtime.theaterName}`}>
    {!compact && <button className="cc-poster-button" onClick={onDetails} aria-label={`Details for ${movie.title}`}>{movie.poster_path ? <img loading="lazy" src={movie.poster_path} alt={movie.title} onError={e => { e.currentTarget.style.display='none'; }}/> : <span className="cc-poster-missing">{movie.title}</span>}</button>}
    <button className="cc-screening-time" onClick={onSelect} aria-pressed={selected} title="Select as the starting point for your evening"><strong>{screeningTime(showtime.startDate)}</strong><strong>{screeningTime(showtime.endDate)}</strong>{selected && <small>Your starting point</small>}{available && <small>Available after your pick</small>}</button>
    <div className="cc-film"><button className="cc-title" onClick={onDetails}>{movie.title}</button><div className="cc-film-meta">{movie.duration ? `${movie.duration} min` : 'Duration not listed'}{movie.releaseYear ? ` · ${movie.releaseYear}` : ''}{!compact && ` · ${spoken}`} · <ImdbLink title={movie.title} year={movie.releaseYear}/>{onHide && <> · <button className="cc-hide-movie" onClick={onHide} aria-label={`Hide ${movie.title} permanently`} title="Hide all screenings until restored in Settings"><EyeOff size={12}/> Hide</button></>}</div>{!compact && <p className="cc-synopsis">{plainDescription(movie.overview)}</p>}{showtime.specials && <span className="cc-special">{showtime.specials}</span>}{onPlan && <button className="cc-row-plan" onClick={onPlan} aria-pressed={selected} aria-label={`Plan my evening after ${movie.title} at ${screeningTime(showtime.startDate)}`}>Plan my evening <ArrowRight size={13}/></button>}</div>
    <div className="cc-venue"><strong>{showtime.theaterName}</strong><span>{showtime.theaterCity}</span>{showtime.ticketingUrl && <a href={showtime.ticketingUrl} target="_blank" rel="noopener noreferrer">Tickets <ExternalLink size={12}/></a>}</div>
    <div className="cc-language"><span>{spoken}</span><small className={hasEnglishSubtitles(showtime.subtitles) ? 'cc-english' : ''}>{subtitles}</small>{showtime.languageVersion && <small>{showtime.languageVersion}</small>}</div>
    <button className={`cc-save ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Remove' : 'Save'} ${movie.title} at ${screeningTime(showtime.startDate)}`} aria-pressed={saved}>{saved ? <Check size={19}/> : <Bookmark size={19}/>}</button>
  </article>;
}
