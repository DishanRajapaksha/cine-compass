import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Movie } from '../types/Movie';
import { movieService } from '../services/movieService';
import CatalogueFilm, { CatalogueProps } from './CatalogueFilm';

export default function NowShowing(props:CatalogueProps) {
  const [city,setCity] = useState<string|null>(props.city);
  const [movies,setMovies] = useState<Movie[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [query,setQuery] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    movieService.getNowShowingMovies(city).then(result => {if(active) setMovies(result);}).catch(() => {if(active) setError('Now showing films could not be loaded. Please try again.');}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[city,retry]);
  const visible = movies.filter(movie => !props.hiddenIds.has(movie.id) && movie.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="cc-coming-soon cc-now-showing" aria-label="Now showing films">
    <div className="cc-results-heading"><h2>Now showing</h2><span aria-live="polite">{loading ? 'Finding films…' : `${visible.length} film${visible.length === 1 ? '' : 's'}`}</span></div>
    <p className="cc-watchlist-hint">Films with published screenings in the next seven days{city ? ` in ${city}` : ''}. Choose a movie, then find a time that suits you.</p>
    <div className="cc-catalogue-filters">
      <label className="cc-search"><Search size={16} aria-hidden="true"/><input aria-label="Search now showing films" placeholder="Search films…" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label className="cc-field">City<select aria-label="Now showing city" value={city || ''} onChange={event => setCity(event.target.value || null)}><option value="">All cities</option>{props.cities.map(value => <option key={value.name} value={value.name}>{value.name}</option>)}{city && !props.cities.some(value => value.name === city) && <option value={city}>{city}</option>}</select></label>
    </div>
    <div aria-busy={loading}>
      {loading ? <div className="cc-loading" role="status"><div/><p>Gathering films…</p></div> : error ? <div className="cc-empty" role="alert"><p>{error}</p><button className="cc-primary" onClick={() => setRetry(value => value+1)}>Try again</button></div> : !visible.length ? <div className="cc-empty"><h3>{query ? 'No films match your search.' : 'No films have published screenings in this city for the next seven days.'}</h3>{query && <button className="cc-text-button" onClick={() => setQuery('')}>Clear search</button>}</div> : visible.map(movie => <CatalogueFilm key={`${city}:${movie.id}`} {...props} city={city} movie={movie} label="Now showing" releaseLabel="Screenings this week"/>)}
    </div>
  </section>;
}
