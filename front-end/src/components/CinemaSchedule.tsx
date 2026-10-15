import { createHiddenMovieMatcher } from '../lib/hiddenMovies';
import { setPreference } from '../lib/accountStorage';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, SlidersHorizontal, Sparkle, X } from 'lucide-react';
import { City, HiddenMovie, Movie, MovieFilters, SavedFilm, SavedShowtime } from '../types/Movie';
import { movieService } from '../services/movieService';
import { getCurrentDateInAmsterdam, getCurrentTimeInAmsterdam, normalizeLanguageCode } from '../lib/utils';
import { amsterdamDate, dateLabel, filterScreenings, readStorage, screeningTime, Screening, writeStorage } from '../lib/schedule';
import ScheduleFilters from './ScheduleFilters';
import SavedFilms from './SavedFilms';
import { loadSavedFilms, savedFilm, savedFilmsKey } from '../lib/watchlist';
import ScreeningRow from './ScreeningRow';
import MovieGroupSummary from './MovieGroupSummary';
import ComingSoon from './ComingSoon';
import NowShowing from './NowShowing';
import HeaderNavigation from './HeaderNavigation';
import FilmDetails from './FilmDetails';
import './CinemaSchedule.css';
import CinemaAnimation from './CinemaAnimation';
import SettingsModal from './SettingsModal';

type View = 'posters' | 'compact';
type Grouping = 'time' | 'movie';
const defaults = (): MovieFilters => ({ selectedCity:'Amsterdam', selectedTheaters:[], selectedSubtitleLanguages:['en'], selectedSpokenLanguages:['en'], languageMatchMode:'any', selectedSpecials:[], startDate:getCurrentDateInAmsterdam(), endDate:getCurrentDateInAmsterdam(), startTime:getCurrentTimeInAmsterdam(), endTime:'23:59' });
const validFilters = (value: unknown): value is MovieFilters => {
  if (!value || typeof value !== 'object') return false;
  const f = value as MovieFilters;
  if (f.watchlistOnly !== undefined && typeof f.watchlistOnly !== 'boolean') return false;
  if (f.languageMatchMode !== undefined && f.languageMatchMode !== 'any' && f.languageMatchMode !== 'all') return false;
  return (f.selectedCity === null || typeof f.selectedCity === 'string') && ['selectedTheaters','selectedSubtitleLanguages','selectedSpokenLanguages','selectedSpecials'].every(key => Array.isArray((f as unknown as Record<string, unknown>)[key]) && ((f as unknown as Record<string, string[]>)[key]).every(item => typeof item === 'string')) && ['startDate','endDate','startTime','endTime'].every(key => (f as unknown as Record<string, unknown>)[key] === null || typeof (f as unknown as Record<string, unknown>)[key] === 'string');
};
const refreshTimeWindow = (f: MovieFilters): MovieFilters => {
  const today = getCurrentDateInAmsterdam();
  const stale = !f.startDate || f.startDate < today;
  const startTime = stale || f.startDate === today || !f.startTime ? getCurrentTimeInAmsterdam() : f.startTime;
  return {...f, startDate: stale ? today : f.startDate, endDate: !f.endDate || f.endDate < today ? today : f.endDate, startTime, endTime: !f.endTime || (startTime && f.endTime < startTime) ? '23:59' : f.endTime};
};
const loadFilters = () => {
  const f = readStorage('cinecompass_schedule_filters', defaults(), validFilters);
  return refreshTimeWindow({...f, ...(f.languageMatchMode ? {} : {selectedSubtitleLanguages:['en'],selectedSpokenLanguages:['en'],languageMatchMode:'any' as const})});
};
const validSaved = (value: unknown): value is SavedShowtime[] => Array.isArray(value) && value.every(s => s && typeof s.showtimeId === 'string' && typeof s.movieId === 'string' && typeof s.startDate === 'string' && typeof s.endDate === 'string' && typeof s.movieTitle === 'string');
const shiftDate = (date: string, amount: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+amount); return d.toISOString().slice(0,10); };

export default function CinemaSchedule() {
  const [filters,setFilters] = useState<MovieFilters>(loadFilters);
  useEffect(() => {
    // Installed PWAs can resume the existing page without mounting again.
    const resume = () => setFilters(refreshTimeWindow);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') resume(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) resume(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  const [query,setQuery] = useState('');
  const [cities,setCities] = useState<City[]>([]);
  const [movies,setMovies] = useState<Movie[]>([]);
  const [loading,setLoading] = useState(true);
  const [citiesLoading,setCitiesLoading] = useState(true);
  const [error,setError] = useState('');
  const [cityError,setCityError] = useState('');
  const [retry,setRetry] = useState(0);
  const [view,setView] = useState<View>(() => readStorage('cinecompass_schedule_view','posters' as View,(v): v is View => ['posters','compact'].includes(v as string)));
  const [grouping,setGrouping] = useState<Grouping>(() => readStorage('cinecompass_schedule_grouping','time' as Grouping,(v): v is Grouping => v === 'time' || v === 'movie'));
  const [saved,setSaved] = useState(() => readStorage('cineville_saved_showtimes',[] as SavedShowtime[],validSaved));
  const [films,setFilms] = useState<SavedFilm[]>(() => loadSavedFilms(saved));
  useEffect(() => {
    if (!movies.length) return;
    const byId = new Map(movies.map(movie => [movie.id,movie]));
    setFilms(previous => {
      const next = previous.map(film => {
        const movie = byId.get(film.id);
        return movie ? {...film,...savedFilm(movie),posterPath:movie.poster_path || film.posterPath} : film;
      });
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [movies]);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [hidden,setHidden] = useState<HiddenMovie[]>(() => readStorage('cinecompass_hidden_movies',[] as HiddenMovie[],(v): v is HiddenMovie[] => Array.isArray(v) && v.every(m => m && typeof m.id === 'string' && typeof m.title === 'string' && (m.year === undefined || typeof m.year === 'number'))));
  const [hiddenError,setHiddenError] = useState('');
  const isHiddenMovie = useMemo(() => createHiddenMovieMatcher(hidden),[hidden]);
  const hiddenIds = new Set(hidden.map(m => m.id));
  for (const movie of [...movies,...films]) if (isHiddenMovie(movie)) hiddenIds.add(movie.id);
  const visibleSaved = saved.filter(s => !hiddenIds.has(s.movieId));
  const visibleFilms = films.filter(f => !hiddenIds.has(f.id));
  const watchlistMovieIds = new Set(visibleFilms.map(f => f.id));
  const updateHidden = (next: HiddenMovie[]) => {
    try {setPreference('cinecompass_hidden_movies',JSON.stringify(next));setHidden(next);setHiddenError('');return true;}
    catch {setHiddenError('Hidden movies could not be saved. Please allow browser storage and try again.');return false;}
  };
  const hideMovie = (movie: HiddenMovie) => {
    if (updateHidden([...hidden.filter(m => m.id !== movie.id),movie])) {
      setSelected(s => s?.movie.id === movie.id ? null : s);
      setDetails(s => s?.movie.id === movie.id ? null : s);
    }
  };
  const [page,setPage] = useState<'schedule'|'watchlist'|'upcoming'|'now-showing'>('schedule');
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [selected,setSelected] = useState<Screening|null>(null);
  const [details,setDetails] = useState<Screening|null>(null);
  const [plannerPrefs,setPlannerPrefs] = useState(() => {
    const valid = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object');
    const prefs = readStorage('cinecompass_planner_prefs', readStorage('cineville_timeline_prefs', {} as Record<string, unknown>, valid), valid);
    return { buffer: typeof prefs.bufferMinutes === 'number' ? Math.min(180,Math.max(0,prefs.bufferMinutes)) : 15, hideUnavailable:prefs.availabilityMode !== 'highlight', hideSameMovie:typeof prefs.hideSameMovie === 'boolean' ? prefs.hideSameMovie : true };
  });
  const {buffer,hideUnavailable,hideSameMovie} = plannerPrefs;
  useEffect(() => writeStorage('cinecompass_planner_prefs',{bufferMinutes:buffer,availabilityMode:hideUnavailable ? 'hide' : 'highlight',hideSameMovie}),[buffer,hideUnavailable,hideSameMovie]);
  useEffect(() => { let active=true; setCitiesLoading(true); setCityError(''); movieService.getTheaters().then(data => { if(active) setCities(data); }).catch(() => { if(active) setCityError('Cinemas could not be loaded. Please retry.'); }).finally(() => { if(active) setCitiesLoading(false); }); return () => { active=false; }; }, [retry]);
  const sourceFilters = useMemo(() => ({ ...defaults(), selectedCity:filters.selectedCity, startDate:filters.startDate, endDate:filters.endDate, selectedSubtitleLanguages:[], selectedSpokenLanguages:[], startTime:null, endTime:null }), [filters.selectedCity,filters.startDate,filters.endDate]);
  const invalidRange = Boolean((filters.startDate && filters.endDate && filters.startDate > filters.endDate) || (filters.startTime && filters.endTime && filters.startTime > filters.endTime));
  useEffect(() => {
    let active=true; setLoading(true); setError('');
    movieService.getPopularMovies(sourceFilters, true).then(data => { if(active) {
      setMovies(data.results);
      setSelected(prev => { const movie = data.results.find(m => m.id===prev?.movie.id); const showtime = movie?.showtimes.find(st => st.id===prev?.showtime.id); return movie && showtime ? {movie,showtime} : null; });
    } }).catch(() => { if(active) setError('The programme could not be loaded. Please try again.'); }).finally(() => { if(active) setLoading(false); });
    return () => { active=false; };
  }, [sourceFilters,retry]);
  useEffect(() => writeStorage('cinecompass_schedule_filters',filters), [filters]);
  useEffect(() => writeStorage('cinecompass_schedule_view',view), [view]);
  useEffect(() => writeStorage('cinecompass_schedule_grouping',grouping), [grouping]);
  useEffect(() => writeStorage('cineville_saved_showtimes',saved), [saved]);
  useEffect(() => writeStorage(savedFilmsKey,films), [films]);
  const languages = useMemo(() => Array.from(new Set([...movies.flatMap(m => m.spokenLanguages.map(normalizeLanguageCode)),...filters.selectedSpokenLanguages])).sort(), [movies,filters.selectedSpokenLanguages]);
  const specials = useMemo(() => Array.from(new Set([...movies.flatMap(m => m.showtimes.flatMap(s => s.specials ? s.specials.split(',').map(v => v.trim()).filter(Boolean) : [])),...filters.selectedSpecials])).sort(), [movies,filters.selectedSpecials]);
  const screenings = useMemo(() => invalidRange ? [] : filterScreenings(movies,filters,query), [movies,filters,query,invalidRange]);
  const anchor = selected && Date.parse(selected.showtime.endDate) + buffer*60000;
  const blocked = (s: Screening) => Boolean(anchor && s.showtime.id !== selected?.showtime.id && Date.parse(s.showtime.startDate) < anchor);
  const visible = screenings.filter(s => !hiddenIds.has(s.movie.id) && (!filters.watchlistOnly || watchlistMovieIds.has(s.movie.id)) && !(hideUnavailable && blocked(s)) && !(hideSameMovie && selected && s.movie.id===selected.movie.id && s.showtime.id!==selected.showtime.id));
  const groups = new Map<string,Screening[]>();
  for (const screening of visible) {
    const key = grouping === 'movie' ? screening.movie.id : amsterdamDate(screening.showtime.startDate);
    const items = groups.get(key);
    if (items) items.push(screening); else groups.set(key,[screening]);
  }
  const reset = () => { setFilters(defaults()); setQuery(''); setSelected(null); };
  const chooseDate = (date: string) => setFilters(f => ({...f,startDate:date,endDate:date,startTime:date === getCurrentDateInAmsterdam() ? getCurrentTimeInAmsterdam() : '00:00',endTime:'23:59'}));
  const toggleFilm = (movie: Movie) => setFilms(prev => prev.some(f => f.id === movie.id) ? prev.filter(f => f.id !== movie.id) : [...prev,savedFilm(movie)]);
  const toggleSave = ({movie,showtime}: Screening) => {
    if (!saved.some(s => s.showtimeId === showtime.id)) setFilms(prev => prev.some(f => f.id === movie.id) ? prev : [...prev,savedFilm(movie)]);
    setSaved(prev => prev.some(s => s.showtimeId === showtime.id) ? prev.filter(s => s.showtimeId !== showtime.id) : [...prev,{movieId:movie.id,movieTitle:movie.title,posterPath:movie.poster_path,showtimeId:showtime.id,startDate:showtime.startDate,endDate:showtime.endDate,theaterId:showtime.theaterId,theaterName:showtime.theaterName,theaterCity:showtime.theaterCity,ticketingUrl:showtime.ticketingUrl}].sort((a,b) => Date.parse(a.startDate)-Date.parse(b.startDate)));
  };
  const startPlanning = (screening: Screening) => {
    setPlannerPrefs(p => ({...p,hideUnavailable:true,hideSameMovie:true}));
    setSelected(screening);
  };
  const planScreening = (screening: Screening) => {
    setDetails(null); setPage('schedule'); startPlanning(screening);
    const date = amsterdamDate(screening.showtime.startDate);
    setFilters(f => ({...f,startDate:date,endDate:date,startTime:null,endTime:'23:59'}));
  };
  return <div className="cc-app">
    <header className="cc-header"><a className="cc-brand" href="#schedule" onClick={() => setPage('schedule')}><Sparkle size={27} fill="currentColor" strokeWidth={1}/><span>Cine Compass<span className="cc-brand-dot">.</span></span></a><CinemaAnimation/><HeaderNavigation page={page} count={visibleFilms.length} onPage={setPage} onSettings={() => setSettingsOpen(true)}/></header>
    <main className="cc-main">
    {hiddenError && <p className="cc-error" role="alert">{hiddenError}</p>}
    {page === 'watchlist' ? <SavedFilms films={visibleFilms} onRemoveFilm={id => setFilms(prev => prev.filter(f => f.id !== id))} saved={visibleSaved} onHide={hideMovie} cities={cities} city={filters.selectedCity} onRemove={id => setSaved(prev => prev.filter(s => s.showtimeId!==id))} onSave={toggleSave} onPlan={planScreening} onBrowse={() => setPage('schedule')}/> : page === 'now-showing' ? <NowShowing films={visibleFilms} isHidden={isHiddenMovie} cities={cities} city={filters.selectedCity} saved={visibleSaved} onToggleFilm={toggleFilm} onHide={movie => hideMovie({id:movie.id,title:movie.title,year:movie.releaseYear})} onSave={toggleSave} onPlan={planScreening}/> : page === 'upcoming' ? <ComingSoon films={visibleFilms} isHidden={isHiddenMovie} cities={cities} city={filters.selectedCity} saved={visibleSaved} onToggleFilm={toggleFilm} onHide={movie => hideMovie({id:movie.id,title:movie.title,year:movie.releaseYear})} onSave={toggleSave} onPlan={planScreening}/> : <>
      <button className="cc-mobile-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}><SlidersHorizontal size={17}/> {filtersOpen ? 'Hide filters' : 'Filters & search'}</button>
      <div className="cc-layout"><div className={filtersOpen ? 'cc-filter-rail is-open' : 'cc-filter-rail'}><ScheduleFilters showWatchlistFilter filters={filters} cities={cities} query={query} languages={languages} specials={specials} loading={citiesLoading} onQuery={setQuery} onChange={setFilters} onReset={reset}/>{cityError && <p className="cc-error">{cityError} <button onClick={() => setRetry(v => v+1)}>Retry</button></p>}</div>
      <section className="cc-programme" aria-label="Programme"><div className="cc-programme-top"><div className="cc-results-heading"><h2>{grouping === 'movie' ? 'By movie' : 'By start time'}</h2><span aria-live="polite">{loading ? 'Finding screenings…' : `${visible.length} screening${visible.length===1 ? "" : "s"} · ${new Set(visible.map(s => s.movie.id)).size} film${new Set(visible.map(s => s.movie.id)).size===1 ? "" : "s"}`}</span></div><div className="cc-programme-controls"><div className="cc-grouping-control"><select aria-label="Group screenings by" value={grouping} onChange={event => setGrouping(event.target.value as Grouping)}><option value="time">By start time</option><option value="movie">By movie</option></select><ChevronDown size={14} aria-hidden="true"/></div><div className="cc-view-switch" aria-label="Display mode">{(['posters','compact'] as View[]).map(v => <button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={() => setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div></div></div>
        <div className="cc-datebar"><div className="cc-date-shortcuts"><button aria-label="Previous day" onClick={() => chooseDate(shiftDate(filters.startDate || getCurrentDateInAmsterdam(),-1))}><ArrowLeft size={16}/></button><button className={filters.startDate===getCurrentDateInAmsterdam() && filters.endDate===filters.startDate?'active':''} onClick={() => chooseDate(getCurrentDateInAmsterdam())}>Today</button><button className={filters.startDate===shiftDate(getCurrentDateInAmsterdam(),1) && filters.endDate===filters.startDate?'active':''} onClick={() => chooseDate(shiftDate(getCurrentDateInAmsterdam(),1))}>Tomorrow</button><button aria-label="Next day" onClick={() => chooseDate(shiftDate(filters.startDate || getCurrentDateInAmsterdam(),1))}><ArrowRight size={16}/></button></div><span>{dateLabel(filters.startDate || getCurrentDateInAmsterdam())}{filters.endDate!==filters.startDate && filters.endDate ? ` – ${dateLabel(filters.endDate)}` : ''}</span></div>
        {selected && <div className="cc-planner"><div><strong>After {selected.movie.title}</strong><span>Next screening from {screeningTime(new Date(anchor || 0).toISOString())}</span></div><label>Travel buffer <input aria-label="Travel buffer minutes" type="number" min="0" max="180" value={buffer} onChange={e => setPlannerPrefs(p => ({...p,buffer:Math.min(180,Math.max(0,Number(e.target.value)))}))}/> min</label><div className="cc-availability-mode" aria-label="Availability display"><button aria-pressed={!hideUnavailable} onClick={() => setPlannerPrefs(p => ({...p,hideUnavailable:false}))}>Highlight available</button><button aria-pressed={hideUnavailable} onClick={() => setPlannerPrefs(p => ({...p,hideUnavailable:true}))}>Hide unavailable</button></div><label><input type="checkbox" checked={hideSameMovie} onChange={e => setPlannerPrefs(p => ({...p,hideSameMovie:e.target.checked}))}/> Hide other showtimes of this movie</label><button aria-label="Clear starting point" onClick={() => setSelected(null)}><X size={17}/></button></div>}
        <div aria-busy={loading}>
        {invalidRange ? <div className="cc-empty"><h3>Check your time window.</h3><p>The end date and time should come after the start.</p></div> : error ? <div className="cc-empty" role="alert"><h3>A brief intermission.</h3><p>{error}</p><button className="cc-primary" onClick={() => setRetry(v => v+1)}>Try again</button></div> : loading ? <div className="cc-loading" role="status"><div/><p>Gathering the programme…</p></div> : !visible.length ? <div className="cc-empty"><h3>{filters.watchlistOnly ? watchlistMovieIds.size ? 'No watchlist films in this window.' : 'Your watchlist is empty.' : 'No screenings in this window.'}</h3><p>{filters.watchlistOnly ? watchlistMovieIds.size ? 'Try a different date, cinema, or language.' : 'Save a film from the programme to add it to your watchlist.' : 'Try a different date, cinema, or language.'}</p><button className="cc-primary" onClick={filters.watchlistOnly ? () => setFilters(f => ({...f,watchlistOnly:false})) : reset}>{filters.watchlistOnly ? 'Show all films' : 'Reset filters'}</button></div> : Array.from(groups).map(([date,items]) => <section key={date} className={`cc-day cc-${view}${grouping === 'movie' ? ' cc-movie-group' : ''}`} aria-label={grouping === 'movie' ? items[0].movie.title : dateLabel(date)}>{grouping === 'movie' ? <MovieGroupSummary movie={items[0].movie} count={items.length} compact={view === 'compact'} saved={watchlistMovieIds.has(items[0].movie.id)} onDetails={() => setDetails(items[0])} onToggleFilm={() => toggleFilm(items[0].movie)} onHide={() => hideMovie({id:items[0].movie.id,title:items[0].movie.title,year:items[0].movie.releaseYear})}/> : <>{groups.size > 1 && <h3 className="cc-day-label">{dateLabel(date)}</h3>}{view === 'compact' && <div className="cc-table-head" aria-hidden="true"><span>Film / duration</span><span>Cinema</span><span>Start / end</span></div>}</>}{items.map(s => <ScreeningRow key={s.showtime.id} screening={s} grouped={grouping === 'movie'} filmSaved={watchlistMovieIds.has(s.movie.id)} onToggleFilm={() => toggleFilm(s.movie)} compact={view !== 'posters' || grouping === 'movie'} saved={saved.some(item => item.showtimeId===s.showtime.id)} selected={selected?.showtime.id===s.showtime.id} unavailable={blocked(s)} available={Boolean(selected && s.showtime.id!==selected.showtime.id && !blocked(s) && !hideUnavailable)} onSave={() => toggleSave(s)} onSelect={() => selected?.showtime.id===s.showtime.id ? setSelected(null) : startPlanning(s)} onDetails={() => setDetails(s)} onPlan={() => startPlanning(s)} onHide={() => hideMovie({id:s.movie.id,title:s.movie.title,year:s.movie.releaseYear})}/>)}</section>)}
        </div><footer className="cc-programme-footer"><span>Programme from Cineville · All times in Amsterdam</span><span>Pick a time to plan a double bill.</span></footer>
      </section></div></>}
    </main>{settingsOpen && <SettingsModal hidden={hidden} onRestore={id => updateHidden(hidden.filter(m => m.id !== id))} onClose={() => setSettingsOpen(false)}/>}
    {details && <FilmDetails movie={details.movie} filmSaved={watchlistMovieIds.has(details.movie.id)} onToggleFilm={() => toggleFilm(details.movie)} screening={details} cities={cities} city={filters.selectedCity} saved={saved} onSave={toggleSave} onPlan={planScreening} onClose={() => setDetails(null)} onHide={() => hideMovie({id:details.movie.id,title:details.movie.title,year:details.movie.releaseYear})}/>}
  </div>;
}
