import React, { useState } from 'react';
import { ArrowRight, Bookmark, ChevronDown, X } from 'lucide-react';
import { City, HiddenMovie, SavedShowtime } from '../types/Movie';
import { amsterdamDate, dateLabel, Screening, screeningTime } from '../lib/schedule';
import FilmShowtimes from './FilmShowtimes';
import ImdbLink from './ImdbLink';

type Props = {onHide: (movie: HiddenMovie) => void; saved: SavedShowtime[]; cities: City[]; city: string | null; onRemove: (id: string) => void; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void; onBrowse: () => void};
function SavedFilm({entries,...props}: Omit<Props,'onBrowse'> & {entries:SavedShowtime[]}) {
  const [expanded,setExpanded] = useState(true);
  const film=entries[0];
  return <section className="cc-saved-film" aria-label={`Saved ${film.movieTitle}`}><div className="cc-saved-film-heading"><div><h3>{film.movieTitle}</h3><ImdbLink title={film.movieTitle}/> · <button className="cc-hide-movie" aria-label={`Hide ${film.movieTitle} permanently`} onClick={() => props.onHide({id:film.movieId,title:film.movieTitle})}>Hide</button></div><button className="cc-text-button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>All showtimes <ChevronDown size={15}/></button></div>
    {entries.map(s => <article className="cc-saved-row" key={s.showtimeId}><div className="cc-saved-time"><strong>{screeningTime(s.startDate)}</strong><small>{dateLabel(amsterdamDate(s.startDate))}</small><small>ends {screeningTime(s.endDate)}</small></div><div><p>{s.theaterName} · {s.theaterCity}</p><small className="cc-saved-marker">Saved screening</small></div>{s.ticketingUrl && <a target="_blank" rel="noopener noreferrer" href={s.ticketingUrl}>Tickets <ArrowRight size={15}/></a>}<button aria-label={`Remove ${s.movieTitle} at ${screeningTime(s.startDate)}`} onClick={() => props.onRemove(s.showtimeId)}><X size={18}/></button></article>)}
    {expanded && <FilmShowtimes movieId={film.movieId} movieTitle={film.movieTitle} cities={props.cities} initialCity={props.city} saved={props.saved} onSave={props.onSave} onPlan={props.onPlan} onHide={movie => props.onHide({id:movie.id,title:movie.title,year:movie.releaseYear})}/>}
  </section>;
}
export default function SavedFilms(props: Props) {
  const grouped=props.saved.reduce<Record<string,SavedShowtime[]>>((map,s) => { (map[s.movieId] ||= []).push(s); return map; },{});
  return <section className="cc-watchlist"><div className="cc-results-heading"><h2>Saved screenings</h2><span>{props.saved.length} screening{props.saved.length===1 ? '' : 's'} · {Object.keys(grouped).length} films</span></div>{!props.saved.length ? <div className="cc-empty"><Bookmark size={30}/><h3>A little room for a good film.</h3><p>Save a screening from the programme to collect it here.</p><button className="cc-primary" onClick={props.onBrowse}>Browse the programme <ArrowRight size={16}/></button></div> : Object.entries(grouped).map(([id,entries]) => <SavedFilm key={id} {...props} entries={entries}/>)}</section>;
}
