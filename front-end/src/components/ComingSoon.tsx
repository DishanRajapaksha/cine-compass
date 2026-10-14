import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Movie } from '../types/Movie';
import { dateLabel } from '../lib/schedule';
import { movieService } from '../services/movieService';
import CataloguePoster from './CataloguePoster';
import CatalogueDetails from './CatalogueDetails';
import CatalogueViewSwitch, { CatalogueView, useCatalogueView } from './CatalogueViewSwitch';
import CatalogueFilm, { CatalogueProps } from './CatalogueFilm';

function releaseWeek(date:string) {
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay()+6)%7);
  return monday.toISOString().slice(0,10);
}
function ReleaseWeekSection({week,movies,view,onOpen,...props}:CatalogueProps & {week:string;movies:Movie[];view:CatalogueView;onOpen:(movie:Movie)=>void}) {
  const [expanded,setExpanded] = useState(true);
  const panelId = useId();
  return <section className="cc-release-week" aria-label={`Release week of ${dateLabel(week)} ${week.slice(0,4)}`}>
    <h3 className="cc-release-week-heading"><button aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>Week of {dateLabel(week)} {week.slice(0,4)}<ChevronDown size={17} aria-hidden="true"/></button></h3>
    <div id={panelId} hidden={!expanded} className={view === 'grid' ? 'cc-catalogue-grid' : undefined}>{movies.map(movie => view === 'grid' ? <CataloguePoster key={movie.id} movie={movie} label="Upcoming" releaseLabel={dateLabel(movie.release_date)} onOpen={() => onOpen(movie)}/> : <CatalogueFilm key={movie.id} {...props} movie={movie} label="Upcoming" releaseLabel={`Expected ${dateLabel(movie.release_date)} ${movie.release_date.slice(0,4)}`}/>)}</div>
  </section>;
}
export default function ComingSoon(props:CatalogueProps) {
  const [view,setView] = useCatalogueView();
  const [details,setDetails] = useState<Movie|null>(null);
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
    <div className="cc-catalogue-heading"><div className="cc-results-heading"><h2>Coming soon</h2><span aria-live="polite">{loading ? 'Finding upcoming films…' : `${visible.length} upcoming film${visible.length === 1 ? '' : 's'}`}</span></div><CatalogueViewSwitch view={view} onChange={setView}/></div>
    <label className="cc-search cc-upcoming-search"><Search size={16} aria-hidden="true"/><input aria-label="Search upcoming films" placeholder="Search upcoming films…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div aria-busy={loading}>
      {loading ? <div className="cc-loading" role="status"><div/><p>Gathering upcoming films…</p></div> : error ? <div className="cc-empty" role="alert"><p>{error}</p><button className="cc-primary" onClick={() => setRetry(value => value+1)}>Try again</button></div> : !visible.length ? <div className="cc-empty"><h3>{query ? 'No upcoming films match your search.' : 'No upcoming films to show yet.'}</h3>{query && <button className="cc-text-button" onClick={() => setQuery('')}>Clear search</button>}</div> : Array.from(weeks).map(([week,films]) => <ReleaseWeekSection key={week} {...props} week={week} movies={films} view={view} onOpen={setDetails}/>)}
    </div>
    {details && <CatalogueDetails {...props} movie={details} releaseLabel={`Expected ${dateLabel(details.release_date)} ${details.release_date.slice(0,4)}`} onClose={() => setDetails(null)}/>}
  </section>;
}
