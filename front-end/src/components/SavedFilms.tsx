import React, { useState } from 'react';
import { ArrowRight, Bookmark, ChevronDown, X } from 'lucide-react';
import { City, HiddenMovie, SavedFilm as Film, SavedShowtime } from '../types/Movie';
import { amsterdamDate, dateLabel, Screening, screeningTime } from '../lib/schedule';
import FilmShowtimes from './FilmShowtimes';
import ImdbLink from './ImdbLink';

type Props = {films: Film[]; onRemoveFilm: (id: string) => void; onHide: (movie: HiddenMovie) => void; saved: SavedShowtime[]; cities: City[]; city: string | null; onRemove: (id: string) => void; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void; onBrowse: () => void};
function FilmCard({film,entries,inWatchlist,...props}: Omit<Props,'films'|'onBrowse'> & {film:Film;entries:SavedShowtime[];inWatchlist:boolean}) {
  const [expanded,setExpanded] = useState(false);
  return <section className="cc-saved-film" aria-label={`Saved ${film.title}`}>
    <div className="cc-saved-film-heading"><div className="cc-watchlist-film-info">
      {film.posterPath && <img className="cc-watchlist-poster" src={film.posterPath} alt={`${film.title} poster`} loading="lazy" onError={e => {e.currentTarget.style.display='none';}}/>}
      <div><h3>{film.title}{film.year ? <small className="cc-watchlist-year">{film.year}</small> : null}</h3><ImdbLink title={film.title} year={film.year}/><div className="cc-watchlist-film-actions">
        {inWatchlist && <button className="cc-text-button" aria-label={`Remove film ${film.title} from watchlist`} onClick={() => props.onRemoveFilm(film.id)}>Remove film</button>}
        <button className="cc-hide-movie" aria-label={`Hide ${film.title} permanently`} onClick={() => props.onHide({id:film.id,title:film.title,year:film.year})}>Hide</button>
      </div></div>
    </div><button className="cc-text-button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide showtimes' : 'Find showtimes'} <ChevronDown size={15}/></button></div>
    {!entries.length && <p className="cc-watchlist-hint">On your watchlist. Choose a screening whenever you’re ready.</p>}
    {entries.map(s => <article className="cc-saved-row" key={s.showtimeId}><div className="cc-saved-time"><strong>{screeningTime(s.startDate)}</strong><small>{dateLabel(amsterdamDate(s.startDate))}</small><small>ends {screeningTime(s.endDate)}</small></div><div><p>{s.theaterName} · {s.theaterCity}</p><small className="cc-saved-marker">{Date.parse(s.startDate) < Date.now() ? 'Past saved screening' : 'Saved screening'}</small></div>{s.ticketingUrl && <a target="_blank" rel="noopener noreferrer" href={s.ticketingUrl}>Tickets <ArrowRight size={15}/></a>}<button aria-label={`Remove ${s.movieTitle} at ${screeningTime(s.startDate)}`} onClick={() => props.onRemove(s.showtimeId)}><X size={18}/></button></article>)}
    {expanded && <FilmShowtimes movieId={film.id} movieTitle={film.title} cities={props.cities} initialCity={props.city} saved={props.saved} onSave={props.onSave} onPlan={props.onPlan} onHide={movie => props.onHide({id:movie.id,title:movie.title,year:movie.releaseYear})}/>}
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
