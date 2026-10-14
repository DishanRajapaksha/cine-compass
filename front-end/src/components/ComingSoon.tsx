import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { City, Movie, SavedFilm, SavedShowtime } from '../types/Movie';
import { dateLabel, Screening } from '../lib/schedule';
import { movieService } from '../services/movieService';
import MovieGroupSummary from './MovieGroupSummary';
import FilmDescription from './FilmDescription';
import FilmShowtimes from './FilmShowtimes';

type Props = {films:SavedFilm[];hiddenIds:Set<string>;cities:City[];city:string|null;saved:SavedShowtime[];onToggleFilm:(movie:Movie)=>void;onHide:(movie:Movie)=>void;onSave:(screening:Screening)=>void;onPlan:(screening:Screening)=>void};
function releaseWeek(date:string) {
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay()+6)%7);
  return monday.toISOString().slice(0,10);
}
function UpcomingFilm({movie,...props}:Props & {movie:Movie}) {
  const [descriptionOpen,setDescriptionOpen] = useState(false);
  const [showtimesOpen,setShowtimesOpen] = useState(false);
  const descriptionId = useId(), showtimesId = useId();
  return <article className={`cc-upcoming-film${descriptionOpen ? ' description-open' : ''}`} aria-label={`Upcoming ${movie.title}`}>
    <MovieGroupSummary movie={movie} compact={false} releaseLabel={`Expected ${dateLabel(movie.release_date)} ${movie.release_date.slice(0,4)}`} saved={props.films.some(film => film.id === movie.id)} onDetails={() => setDescriptionOpen(value => !value)} onToggleFilm={() => props.onToggleFilm(movie)} onHide={() => props.onHide(movie)}/>
    <div className="cc-upcoming-actions">
      <button className="cc-text-button" aria-expanded={descriptionOpen} aria-controls={descriptionId} onClick={() => setDescriptionOpen(value => !value)}>{descriptionOpen ? 'Hide synopsis' : 'Read synopsis'} <ChevronDown size={14}/></button>
      <button className="cc-watchlist-showtimes" aria-expanded={showtimesOpen} aria-controls={showtimesId} onClick={() => setShowtimesOpen(value => !value)}>{showtimesOpen ? 'Hide showtimes' : 'Find showtimes'} <ChevronDown size={14}/></button>
    </div>
    <div id={descriptionId} hidden={!descriptionOpen} className="cc-upcoming-synopsis">{descriptionOpen && <FilmDescription movie={movie}/>}</div>
    <div id={showtimesId} hidden={!showtimesOpen}>{showtimesOpen && <FilmShowtimes movieId={movie.id} movieTitle={movie.title} cities={props.cities} initialCity={props.city} saved={props.saved} onSave={props.onSave} onPlan={props.onPlan} onHide={props.onHide}/>}</div>
  </article>;
}
export default function ComingSoon(props:Props) {
  const [movies,setMovies] = useState<Movie[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [query,setQuery] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    movieService.getUpcomingMovies().then(result => {if(active) setMovies(result);}).catch(() => {if(active) setError('Upcoming films could not be loaded. Please try again.');}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[retry]);
  const visible = movies.filter(movie => !props.hiddenIds.has(movie.id) && movie.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const weeks = new Map<string,Movie[]>();
  for (const movie of visible) {
    const week = releaseWeek(movie.release_date);
    const films = weeks.get(week);
    if (films) films.push(movie); else weeks.set(week,[movie]);
  }
  return <section className="cc-coming-soon" aria-label="Coming soon films">
    <div className="cc-results-heading"><h2>Coming soon</h2><span aria-live="polite">{loading ? 'Finding upcoming films…' : `${visible.length} upcoming film${visible.length === 1 ? '' : 's'}`}</span></div>
    <p className="cc-watchlist-hint">Save a film before it reaches the programme. Expected release dates are supplied by Cineville; individual cinemas may publish screenings later.</p>
    <label className="cc-search cc-upcoming-search"><Search size={16} aria-hidden="true"/><input aria-label="Search upcoming films" placeholder="Search upcoming films…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div aria-busy={loading}>
      {loading ? <div className="cc-loading" role="status"><div/><p>Gathering upcoming films…</p></div> : error ? <div className="cc-empty" role="alert"><p>{error}</p><button className="cc-primary" onClick={() => setRetry(value => value+1)}>Try again</button></div> : !visible.length ? <div className="cc-empty"><h3>{query ? 'No upcoming films match your search.' : 'No upcoming films to show yet.'}</h3>{query && <button className="cc-text-button" onClick={() => setQuery('')}>Clear search</button>}</div> : Array.from(weeks).map(([week,films]) => <section key={week} className="cc-release-week" aria-label={`Release week of ${dateLabel(week)} ${week.slice(0,4)}`}><h3 className="cc-release-week-heading">Week of {dateLabel(week)} {week.slice(0,4)}</h3>{films.map(movie => <UpcomingFilm key={movie.id} {...props} movie={movie}/>)}</section>)}
    </div>
  </section>;
}
