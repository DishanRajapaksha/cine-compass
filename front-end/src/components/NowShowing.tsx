import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { emptyCatalogueRanges, filterCatalogue, hasCatalogueRanges, invalidCatalogueRanges } from '../lib/catalogueFilters';
import CatalogueRangeFilters from './CatalogueRangeFilters';
import { Movie } from '../types/Movie';
import { catalogueSortOptions, CatalogueSort, sortCatalogue } from '../lib/catalogueSort';
import { readStorage, writeStorage } from '../lib/schedule';
import { movieService } from '../services/movieService';
import CataloguePoster from './CataloguePoster';
import CatalogueDetails from './CatalogueDetails';
import CatalogueViewSwitch, { useCatalogueView } from './CatalogueViewSwitch';
import CatalogueFilm, { CatalogueProps } from './CatalogueFilm';

export default function NowShowing(props:CatalogueProps) {
  const [view,setView] = useCatalogueView();
  const [details,setDetails] = useState<Movie|null>(null);
  const [city,setCity] = useState<string|null>(props.city);
  const [movies,setMovies] = useState<Movie[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [sort,setSort] = useState<CatalogueSort>(() => readStorage('cinecompass_now_showing_sort','title-asc' as CatalogueSort,(value):value is CatalogueSort => catalogueSortOptions.some(option => option.value === value)));
  useEffect(() => writeStorage('cinecompass_now_showing_sort',sort),[sort]);
  const [ranges,setRanges] = useState(emptyCatalogueRanges);
  const clearFilters = () => {setRanges(emptyCatalogueRanges());setQuery('');};
  const [query,setQuery] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    movieService.getNowShowingMovies(city).then(result => {if(active) setMovies(result);}).catch(() => {if(active) setError('Now showing films could not be loaded. Please try again.');}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[city,retry]);
  const invalidRanges = invalidCatalogueRanges(ranges);
  const filtered = Boolean(query || hasCatalogueRanges(ranges));
  const visible = sortCatalogue(filterCatalogue(movies.filter(movie => !props.hiddenIds.has(movie.id) && movie.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),ranges),sort);
  return <section className="cc-coming-soon cc-now-showing" aria-label="Now showing films">
    <div className="cc-catalogue-heading"><div className="cc-results-heading"><h2>Now showing</h2><span aria-live="polite">{loading ? 'Finding films…' : `${visible.length} film${visible.length === 1 ? '' : 's'}`}</span></div><CatalogueViewSwitch view={view} onChange={setView}/></div>
    <div className="cc-catalogue-filters cc-now-showing-filters">
      <label className="cc-search"><Search size={16} aria-hidden="true"/><input aria-label="Search now showing films" placeholder="Search films…" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label className="cc-field">City<select aria-label="Now showing city" value={city || ''} onChange={event => {setDetails(null);setCity(event.target.value || null);}}><option value="">All cities</option>{props.cities.map(value => <option key={value.name} value={value.name}>{value.name}</option>)}{city && !props.cities.some(value => value.name === city) && <option value={city}>{city}</option>}</select></label>
      <label className="cc-field">Sort by<select aria-label="Sort now showing films" value={sort} onChange={event => setSort(event.target.value as CatalogueSort)}>{catalogueSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    <CatalogueRangeFilters ranges={ranges} onChange={setRanges} onClear={clearFilters}/>
    <div aria-busy={loading}>
      {invalidRanges ? <div className="cc-empty" role="alert"><p>Minimum values must not exceed maximum values. Years and runtimes must be positive.</p></div> : loading ? <div className="cc-loading" role="status"><div/><p>Gathering films…</p></div> : error ? <div className="cc-empty" role="alert"><p>{error}</p><button className="cc-primary" onClick={() => setRetry(value => value+1)}>Try again</button></div> : !visible.length ? <div className="cc-empty"><h3>{filtered ? 'No films match these filters.' : 'No films have published screenings in this city for the next seven days.'}</h3>{filtered && <button className="cc-text-button" onClick={clearFilters}>Clear filters</button>}</div> : <div className={view === 'grid' ? 'cc-catalogue-grid' : undefined}>{visible.map(movie => view === 'grid' ? <CataloguePoster key={movie.id} movie={movie} label="Now showing" onOpen={() => setDetails(movie)}/> : <CatalogueFilm key={`${city}:${movie.id}`} {...props} city={city} movie={movie} label="Now showing"/>)}</div>}
    </div>
    {details && <CatalogueDetails {...props} city={city} movie={details} onClose={() => setDetails(null)}/>}
  </section>;
}
