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
  const [tab,setTab] = useState<'movies' | 'showtimes'>('movies');
  const tabsId = useId();
  const grouped=props.saved.reduce<Record<string,SavedShowtime[]>>((map,s) => { (map[s.movieId] ||= []).push(s); return map; },{});
  const filmsById=new Map(props.films.map(f => [f.id,f]));
  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next=event.key === 'Home' ? 'movies' : event.key === 'End' ? 'showtimes' : tab === 'movies' ? 'showtimes' : 'movies';
    setTab(next);
    document.getElementById(`${tabsId}-${next}-tab`)?.focus();
  }
  return <section className="cc-watchlist">
    <div className="cc-results-heading"><h2>Watchlist</h2><span>{props.films.length} film{props.films.length===1 ? '' : 's'} · {props.saved.length} saved screening{props.saved.length===1 ? '' : 's'}</span></div>
    <div className="cc-watchlist-tabs" role="tablist" aria-label="Watchlist lists">
      {(['movies','showtimes'] as const).map(value => <button key={value} id={`${tabsId}-${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`${tabsId}-${value}-panel`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={onTabKeyDown}>{value === 'movies' ? 'Movies' : 'Saved showtimes'} <span className="cc-count">{value === 'movies' ? props.films.length : props.saved.length}</span></button>)}
    </div>
    <div id={`${tabsId}-movies-panel`} role="tabpanel" aria-labelledby={`${tabsId}-movies-tab`} hidden={tab !== 'movies'} tabIndex={0}>
      {!props.films.length ? <div className="cc-empty"><Bookmark size={30}/><h3>A little room for a good film.</h3><p>Save a film from the programme without choosing a screening.</p><button className="cc-primary" onClick={props.onBrowse}>Browse the programme <ArrowRight size={16}/></button></div> : props.films.map(film => <FilmCard key={film.id} {...props} film={film} entries={[]} inWatchlist/>)}
    </div>
    <div id={`${tabsId}-showtimes-panel`} role="tabpanel" aria-labelledby={`${tabsId}-showtimes-tab`} hidden={tab !== 'showtimes'} tabIndex={0}>
      {!props.saved.length ? <div className="cc-empty"><Ticket size={30}/><h3>No saved showtimes yet.</h3><p>Save a screening from the programme to keep its time and cinema here.</p><button className="cc-primary" onClick={props.onBrowse}>Browse the programme <ArrowRight size={16}/></button></div> : Object.entries(grouped).map(([id,entries]) => <FilmCard key={id} {...props} film={filmsById.get(id) || {id,title:entries[0].movieTitle,posterPath:entries[0].posterPath}} entries={entries} inWatchlist={false}/>)}
    </div>
  </section>;
}
