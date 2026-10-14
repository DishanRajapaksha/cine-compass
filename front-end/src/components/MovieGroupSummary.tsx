import React, { useState } from 'react';
import { Bookmark, EyeOff, Film } from 'lucide-react';
import { Movie } from '../types/Movie';
import { formatDuration, languageName } from '../lib/schedule';
import { plainDescription } from './ScreeningRow';
import ImdbLink from './ImdbLink';

type Props = {movie:Movie;count?:number;releaseLabel?:string;compact:boolean;saved:boolean;onDetails:()=>void;onToggleFilm:()=>void;onHide:()=>void};
export default function MovieGroupSummary({movie,count,releaseLabel,compact,saved,onDetails,onToggleFilm,onHide}:Props) {
  const [posterFailed,setPosterFailed] = useState(false);
  return <div className={`cc-movie-summary${compact ? ' is-compact-summary' : ''}`}>
    {!compact && <button className="cc-movie-summary-poster" onClick={onDetails} aria-label={`Details for ${movie.title}`}>
      {movie.poster_path && !posterFailed ? <img src={movie.poster_path} alt={`${movie.title} poster`} loading="lazy" onError={() => setPosterFailed(true)}/> : <Film size={28} aria-hidden="true"/>}
    </button>}
    <div className="cc-movie-summary-info">
      <h3><button onClick={onDetails}>{movie.title}</button></h3>
      <p className="cc-movie-summary-meta">{[movie.releaseYear,movie.duration ? formatDuration(movie.duration) : null,movie.spokenLanguages.map(languageName).join(', ')].filter(Boolean).join(' · ')}<span>{releaseLabel || (count !== undefined ? `${count} screening${count === 1 ? '' : 's'}` : '')}</span></p>
      {movie.overview && <p className="cc-movie-summary-description">{plainDescription(movie.overview)}</p>}
      <div className="cc-movie-summary-actions">
        <ImdbLink title={movie.title} year={movie.releaseYear}/>
        <button aria-label={`${saved ? 'Remove' : 'Save'} film ${movie.title} ${saved ? 'from' : 'to'} watchlist`} aria-pressed={saved} onClick={onToggleFilm}><Bookmark size={14} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'On watchlist' : 'Watchlist'}</button>
        <button aria-label={`Hide ${movie.title} permanently`} onClick={onHide}><EyeOff size={14}/>Hide</button>
      </div>
    </div>
  </div>;
}
