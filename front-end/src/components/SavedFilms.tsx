import React, { useId, useState } from 'react';
import { ArrowRight, Bookmark, ChevronDown, EyeOff, Film as FilmIcon, Ticket, X } from 'lucide-react';
import { City, HiddenMovie, SavedFilm as Film, SavedShowtime } from '../types/Movie';
import { amsterdamDate, dateLabel, languageName, Screening, screeningTime } from '../lib/schedule';
import { normalizeLanguageCode } from '../lib/utils';
import FilmShowtimes from './FilmShowtimes';
import ImdbLink from './ImdbLink';

type Props = {films: Film[]; onRemoveFilm: (id: string) => void; onHide: (movie: HiddenMovie) => void; saved: SavedShowtime[]; cities: City[]; city: string | null; onRemove: (id: string) => void; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void; onBrowse: () => void};
function FilmCard({film,entries,inWatchlist,...props}: Omit<Props,'films'|'onBrowse'> & {film:Film;entries:SavedShowtime[];inWatchlist:boolean}) {
  const [expanded,setExpanded] = useState(false);
  const [posterFailed,setPosterFailed] = useState(false);
  const showtimesId = useId();
  const languages = Array.from(new Set((film.spokenLanguages || []).map(normalizeLanguageCode))).map(languageName);
  const subtitles = Array.from(new Set((film.availableSubtitles || []).map(normalizeLanguageCode))).map(languageName);
  const metadata = [film.duration ? `${film.duration} min` : null,languages.length ? languages.join(', ') : null].filter(Boolean);
  return <section className="cc-saved-film" aria-label={`Saved ${film.title}`}>
    <div className="cc-saved-film-heading">
      <div className="cc-watchlist-artwork">
        {film.posterPath && !posterFailed ? <img className="cc-watchlist-poster" src={film.posterPath} alt={`${film.title} poster`} loading="lazy" onError={() => setPosterFailed(true)}/> : <FilmIcon size={24} aria-hidden="true"/>}
      </div>
      <div className="cc-watchlist-film-info"><h3>{film.title}{film.year ? <small className="cc-watchlist-year">{film.year}</small> : null}</h3>{metadata.length > 0 && <p className="cc-watchlist-metadata">{metadata.join(' · ')}</p>}{subtitles.length > 0 && <p className="cc-watchlist-subtitles">Subtitles available: {subtitles.join(', ')}</p>}</div>
      <div className="cc-watchlist-film-actions">
        <ImdbLink title={film.title} year={film.year}/>
        {inWatchlist && <button className="cc-watchlist-icon" aria-label={`Remove film ${film.title} from watchlist`} title="Remove film from watchlist" aria-pressed="true" onClick={() => props.onRemoveFilm(film.id)}><Bookmark size={17} fill="currentColor"/></button>}
        <button className="cc-watchlist-icon" aria-label={`Hide ${film.title} permanently`} title="Hide this film" onClick={() => props.onHide({id:film.id,title:film.title,year:film.year})}><EyeOff size={17}/></button>
      </div>
    </div>
    {entries.length > 0 && <div className="cc-watchlist-screenings">{entries.map(s => <article className="cc-saved-row" key={s.showtimeId} aria-label={`Saved screening for ${s.movieTitle} at ${screeningTime(s.startDate)}`}>
      <div className="cc-saved-time"><strong>{screeningTime(s.startDate)} <span>–</span> {screeningTime(s.endDate)}</strong><small>{dateLabel(amsterdamDate(s.startDate))}</small></div>
      <div className="cc-saved-venue"><strong>{s.theaterName}</strong><span>{s.theaterCity}</span>{Date.parse(s.startDate) < Date.now() && <small className="cc-saved-marker">Past saved screening</small>}</div>
      <div className="cc-saved-screening-actions">{s.ticketingUrl && <a target="_blank" rel="noopener noreferrer" href={s.ticketingUrl} aria-label={`Tickets for ${s.movieTitle}`}><Ticket size={15}/><span className="cc-saved-ticket-label">Tickets</span></a>}<button className="cc-watchlist-icon" aria-label={`Remove ${s.movieTitle} at ${screeningTime(s.startDate)}`} title="Remove saved screening" onClick={() => props.onRemove(s.showtimeId)}><X size={17}/></button></div>
    </article>)}</div>}
    <div className="cc-watchlist-showtimes-toggle"><button className="cc-watchlist-showtimes" aria-expanded={expanded} aria-controls={showtimesId} onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide showtimes' : 'Find showtimes'} <ChevronDown size={15}/></button></div>
    <div id={showtimesId} className="cc-watchlist-showtimes-panel" hidden={!expanded}>{expanded && <FilmShowtimes movieId={film.id} movieTitle={film.title} cities={props.cities} initialCity={props.city} saved={props.saved} onSave={props.onSave} onPlan={props.onPlan} onHide={movie => props.onHide({id:movie.id,title:movie.title,year:movie.releaseYear})}/>}</div>
  </section>;
}
export default function SavedFilms(props: Props) {
  const grouped=props.saved.reduce<Record<string,SavedShowtime[]>>((map,s) => { (map[s.movieId] ||= []).push(s); return map; },{});
  const filmIds=new Set(props.films.map(f => f.id));
  const screeningOnly=Object.entries(grouped).filter(([id]) => !filmIds.has(id));
  return <section className="cc-watchlist">
    <div className="cc-results-heading"><h2>Watchlist</h2><span>{props.films.length} film{props.films.length===1 ? '' : 's'} · {props.saved.length} saved screening{props.saved.length===1 ? '' : 's'}</span></div>
    {!props.films.length ? <div className="cc-empty"><Bookmark size={30}/><h3>A little room for a good film.</h3><p>Save a film from the programme without choosing a screening.</p><button className="cc-primary" onClick={props.onBrowse}>Browse the programme <ArrowRight size={16}/></button></div> : props.films.map(film => <FilmCard key={film.id} {...props} film={film} entries={grouped[film.id] || []} inWatchlist/>)}
    {screeningOnly.length > 0 && <section aria-label="Saved screenings outside your watchlist"><h2 className="cc-screening-only-title">Other saved screenings</h2><p className="cc-watchlist-hint">These films have been removed from your watchlist. Your screening times are still saved.</p>{screeningOnly.map(([id,entries]) => <FilmCard key={id} {...props} film={{id,title:entries[0].movieTitle,posterPath:entries[0].posterPath}} entries={entries} inWatchlist={false}/>)}</section>}
  </section>;
}
