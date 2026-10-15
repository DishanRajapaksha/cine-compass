import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Movie } from '../types/Movie';
import { catalogueSortOptions, CatalogueSort, sortCatalogue } from '../lib/catalogueSort';
import { emptyCatalogueRanges, filterCatalogue, hasCatalogueRanges, invalidCatalogueRanges } from '../lib/catalogueFilters';
import CatalogueRangeFilters from './CatalogueRangeFilters';
import { dateLabel, readStorage, writeStorage } from '../lib/schedule';
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
  const [sort,setSort] = useState<CatalogueSort>(() => readStorage('cinecompass_upcoming_sort','release-asc' as CatalogueSort,(value):value is CatalogueSort => catalogueSortOptions.some(option => option.value === value)));
  useEffect(() => writeStorage('cinecompass_upcoming_sort',sort),[sort]);
  const [ranges,setRanges] = useState(emptyCatalogueRanges);
  const clearFilters = () => {setRanges(emptyCatalogueRanges());setQuery('');};
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    movieService.getUpcomingMovies().then(result => {if(active) setMovies(result);}).catch(() => {if(active) setError('Upcoming films could not be loaded. Please try again.');}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[retry]);
  const invalidRanges = invalidCatalogueRanges(ranges);
  const filtered = Boolean(query || hasCatalogueRanges(ranges));
  const visible = sortCatalogue(filterCatalogue(movies.filter(movie => !props.isHidden(movie) && movie.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),ranges),sort);
  const weeks = new Map<string,Movie[]>();
  for (const movie of visible) {
    const week = releaseWeek(movie.release_date);
    const films = weeks.get(week);
    if (films) films.push(movie); else weeks.set(week,[movie]);
  }
  return <section className="cc-coming-soon" aria-label="Coming soon films">
    <div className="cc-catalogue-heading"><div className="cc-results-heading"><h2>Coming soon</h2><span aria-live="polite">{loading ? 'Finding upcoming films…' : `${visible.length} upcoming film${visible.length === 1 ? '' : 's'}`}</span></div><CatalogueViewSwitch view={view} onChange={setView}/></div>
    <div className="cc-catalogue-filters"><label className="cc-search"><Search size={16} aria-hidden="true"/><input aria-label="Search upcoming films" placeholder="Search upcoming films…" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label className="cc-field">Sort by<select aria-label="Sort upcoming films" value={sort} onChange={event => setSort(event.target.value as CatalogueSort)}>{catalogueSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    <CatalogueRangeFilters movies={movies} ranges={ranges} onChange={setRanges} onClear={clearFilters}/>
    <div aria-busy={loading}>
      {invalidRanges ? <div className="cc-empty" role="alert"><p>Minimum values must not exceed maximum values. Years and runtimes must be positive.</p></div> : loading ? <div className="cc-loading" role="status"><div/><p>Gathering upcoming films…</p></div> : error ? <div className="cc-empty" role="alert"><p>{error}</p><button className="cc-primary" onClick={() => setRetry(value => value+1)}>Try again</button></div> : !visible.length ? <div className="cc-empty"><h3>{filtered ? 'No upcoming films match these filters.' : 'No upcoming films to show yet.'}</h3>{filtered && <button className="cc-text-button" onClick={clearFilters}>Clear filters</button>}</div> : Array.from(weeks).sort(([a],[b]) => a.localeCompare(b)*(sort === 'release-desc' ? -1 : 1)).map(([week,films]) => <ReleaseWeekSection key={week} {...props} week={week} movies={films} view={view} onOpen={setDetails}/>)}
    </div>
    {details && <CatalogueDetails {...props} movie={details} releaseLabel={`Expected ${dateLabel(details.release_date)} ${details.release_date.slice(0,4)}`} onClose={() => setDetails(null)}/>}
  </section>;
}
