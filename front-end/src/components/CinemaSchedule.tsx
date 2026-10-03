import { setPreference } from '../lib/accountStorage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, SlidersHorizontal, Sparkle, X } from 'lucide-react';
import { City, HiddenMovie, Movie, MovieFilters, SavedShowtime } from '../types/Movie';
import { movieService } from '../services/movieService';
import { getCurrentDateInAmsterdam, getCurrentTimeInAmsterdam, normalizeLanguageCode } from '../lib/utils';
import { amsterdamDate, dateLabel, filterScreenings, languageName, readStorage, screeningTime, Screening, writeStorage } from '../lib/schedule';
import ScheduleFilters from './ScheduleFilters';
import SavedFilms from './SavedFilms';
import FilmShowtimes from './FilmShowtimes';
import ScreeningRow from './ScreeningRow';
import FilmDescription from './FilmDescription';
import './CinemaSchedule.css';
import ImdbLink from './ImdbLink';
import CinemaAnimation from './CinemaAnimation';
import SettingsModal from './SettingsModal';

type View = 'posters' | 'compact';
const defaults = (): MovieFilters => ({ selectedCity:'Amsterdam', selectedTheaters:[], selectedSubtitleLanguages:['en'], selectedSpokenLanguages:['en'], languageMatchMode:'any', selectedSpecials:[], startDate:getCurrentDateInAmsterdam(), endDate:getCurrentDateInAmsterdam(), startTime:getCurrentTimeInAmsterdam(), endTime:'23:59' });
const validFilters = (value: unknown): value is MovieFilters => {
  if (!value || typeof value !== 'object') return false;
  const f = value as MovieFilters;
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

function FilmDetails({ screening, cities, city, saved, onSave, onPlan, onClose, onHide }: { onHide: () => void; screening: Screening; cities: City[]; city: string | null; saved: SavedShowtime[]; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void; onClose: () => void }) {
  const movie = screening.movie;
  const showtime = screening.showtime;
  const [showtimesOpen, setShowtimesOpen] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isSaved = saved.some(s => s.showtimeId === showtime.id);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className={`cc-dialog cc-film-dialog ${showtimesOpen ? "cc-dialog-showtimes" : ""}`} onCancel={onClose} onClick={e => { if(e.target === e.currentTarget) onClose(); }} aria-labelledby="cc-detail-title">
    <button className="cc-dialog-close" aria-label="Close film details" onClick={onClose}><X size={22}/></button>
    <div className={`cc-detail-hero ${!movie.poster_path || posterFailed ? 'without-poster' : ''}`}>
      {movie.poster_path && !posterFailed && <div className="cc-detail-poster"><img src={movie.poster_path} alt={`${movie.title} poster`} onError={() => setPosterFailed(true)}/></div>}
      <div className="cc-detail-intro">
        <span className="cc-detail-eyebrow">In the programme{showtime.specials ? ` · ${showtime.specials}` : ''}</span>
        <h2 id="cc-detail-title">{movie.title}</h2>
        <p className="cc-detail-meta">{[movie.releaseYear || null,movie.duration ? `${movie.duration} min` : 'Duration not listed',movie.spokenLanguages.map(languageName).join(', ') || 'Language not listed'].filter(Boolean).join(' · ')}</p>
        <div className="cc-detail-links"><ImdbLink title={movie.title} year={movie.releaseYear}/><button className="cc-hide-movie" onClick={onHide}>Hide this movie</button></div>
      </div>
      <div className="cc-detail-story">
        <FilmDescription key={`${movie.id}:${movie.overview}`} movie={movie}/>
        {(movie.directors.length > 0 || movie.cast.length > 0) && <dl className="cc-detail-credits">
          {movie.directors.length > 0 && <div><dt>Directed by</dt><dd>{movie.directors.join(', ')}</dd></div>}
          {movie.cast.length > 0 && <div><dt>Cast</dt><dd>{movie.cast.join(', ')}</dd></div>}
        </dl>}
      </div>
    </div>
    <section className="cc-detail-screening" aria-label="Selected screening">
      <div className="cc-detail-screening-info"><span className="cc-detail-eyebrow">Your screening · {dateLabel(amsterdamDate(showtime.startDate))}</span><div className="cc-detail-screening-line"><strong>{screeningTime(showtime.startDate)} – {screeningTime(showtime.endDate)}</strong><span>{showtime.theaterName} <small>{showtime.theaterCity}</small></span></div></div>
      <div className="cc-detail-actions"><button className="cc-primary" onClick={() => onPlan(screening)}>Plan my evening <ArrowRight size={16}/></button><button className="cc-text-button" aria-pressed={isSaved} onClick={() => onSave(screening)}>{isSaved ? 'Remove saved screening' : 'Save screening'}</button>{showtime.ticketingUrl && <a className="cc-text-button" href={showtime.ticketingUrl} target="_blank" rel="noopener noreferrer">Tickets ↗</a>}</div>
    </section>
    <div className="cc-detail-showtimes-toggle"><button className="cc-text-button" aria-expanded={showtimesOpen} onClick={() => setShowtimesOpen(v => !v)}>{showtimesOpen ? 'Hide all showtimes' : 'All showtimes for this film'} <span aria-hidden="true">{showtimesOpen ? '−' : '+'}</span></button></div>
    {showtimesOpen && <FilmShowtimes movieId={movie.id} movieTitle={movie.title} cities={cities} initialCity={city} saved={saved} onSave={onSave} onPlan={onPlan}/>}
  </dialog>;
}

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
  const [saved,setSaved] = useState(() => readStorage('cineville_saved_showtimes',[] as SavedShowtime[],validSaved));
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [hidden,setHidden] = useState<HiddenMovie[]>(() => readStorage('cinecompass_hidden_movies',[] as HiddenMovie[],(v): v is HiddenMovie[] => Array.isArray(v) && v.every(m => m && typeof m.id === 'string' && typeof m.title === 'string' && (m.year === undefined || typeof m.year === 'number'))));
  const [hiddenError,setHiddenError] = useState('');
  const hiddenIds = new Set(hidden.map(m => m.id));
  const visibleSaved = saved.filter(s => !hiddenIds.has(s.movieId));
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
  const [page,setPage] = useState<'schedule'|'watchlist'>('schedule');
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
  useEffect(() => writeStorage('cineville_saved_showtimes',saved), [saved]);
  const languages = useMemo(() => Array.from(new Set([...movies.flatMap(m => m.spokenLanguages.map(normalizeLanguageCode)),...filters.selectedSpokenLanguages])).sort(), [movies,filters.selectedSpokenLanguages]);
  const specials = useMemo(() => Array.from(new Set([...movies.flatMap(m => m.showtimes.flatMap(s => s.specials ? s.specials.split(',').map(v => v.trim()).filter(Boolean) : [])),...filters.selectedSpecials])).sort(), [movies,filters.selectedSpecials]);
  const screenings = useMemo(() => invalidRange ? [] : filterScreenings(movies,filters,query), [movies,filters,query,invalidRange]);
  const anchor = selected && Date.parse(selected.showtime.endDate) + buffer*60000;
  const blocked = (s: Screening) => Boolean(anchor && s.showtime.id !== selected?.showtime.id && Date.parse(s.showtime.startDate) < anchor);
  const visible = screenings.filter(s => !hiddenIds.has(s.movie.id) && !(hideUnavailable && blocked(s)) && !(hideSameMovie && selected && s.movie.id===selected.movie.id && s.showtime.id!==selected.showtime.id));
  const groups = visible.reduce<Record<string,Screening[]>>((map,s) => { const key=amsterdamDate(s.showtime.startDate); (map[key] ||= []).push(s); return map; }, {});
  const reset = () => { setFilters(defaults()); setQuery(''); setSelected(null); };
  const chooseDate = (date: string) => setFilters(f => ({...f,startDate:date,endDate:date}));
  const toggleSave = ({movie,showtime}: Screening) => setSaved(prev => prev.some(s => s.showtimeId === showtime.id) ? prev.filter(s => s.showtimeId !== showtime.id) : [...prev,{movieId:movie.id,movieTitle:movie.title,posterPath:movie.poster_path,showtimeId:showtime.id,startDate:showtime.startDate,endDate:showtime.endDate,theaterId:showtime.theaterId,theaterName:showtime.theaterName,theaterCity:showtime.theaterCity,ticketingUrl:showtime.ticketingUrl}].sort((a,b) => Date.parse(a.startDate)-Date.parse(b.startDate)));
  const planScreening = (screening: Screening) => {
    setDetails(null); setPage('schedule'); setSelected(screening); setQuery('');
    const date = amsterdamDate(screening.showtime.startDate);
    setFilters(f => ({...f,selectedCity:screening.showtime.theaterCity,selectedTheaters:[],selectedSubtitleLanguages:[],selectedSpokenLanguages:[],selectedSpecials:[],startDate:date,endDate:date,startTime:null,endTime:'23:59'}));
  };
  return <div className="cc-app">
    <header className="cc-header"><a className="cc-brand" href="#schedule"><Sparkle size={27} fill="currentColor" strokeWidth={1}/><span>Cine Compass<span className="cc-brand-dot">.</span></span></a><CinemaAnimation/><nav aria-label="Main navigation"><button className={page==='schedule'?'active':''} onClick={() => setPage('schedule')}>Schedule</button><button className={page==='watchlist'?'active':''} onClick={() => setPage('watchlist')}>Watchlist <span className="cc-count">{visibleSaved.length}</span></button><button onClick={() => setSettingsOpen(true)} aria-haspopup="dialog">Settings</button></nav></header>
    <main className="cc-main">
    {hiddenError && <p className="cc-error" role="alert">{hiddenError}</p>}
    {page === 'watchlist' ? <SavedFilms saved={visibleSaved} onHide={hideMovie} cities={cities} city={filters.selectedCity} onRemove={id => setSaved(prev => prev.filter(s => s.showtimeId!==id))} onSave={toggleSave} onPlan={planScreening} onBrowse={() => setPage('schedule')}/> : <>
      <button className="cc-mobile-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}><SlidersHorizontal size={17}/> {filtersOpen ? 'Hide filters' : 'Filters & search'}</button>
      <div className="cc-layout"><div className={filtersOpen ? 'cc-filter-rail is-open' : 'cc-filter-rail'}><ScheduleFilters filters={filters} cities={cities} query={query} languages={languages} specials={specials} loading={citiesLoading} onQuery={setQuery} onChange={setFilters} onReset={reset}/>{cityError && <p className="cc-error">{cityError} <button onClick={() => setRetry(v => v+1)}>Retry</button></p>}</div>
      <section className="cc-programme" aria-label="Programme"><div className="cc-programme-top"><div className="cc-results-heading"><h2>By start time</h2><span aria-live="polite">{loading ? 'Finding screenings…' : `${visible.length} screening${visible.length===1 ? "" : "s"} · ${new Set(visible.map(s => s.movie.id)).size} film${new Set(visible.map(s => s.movie.id)).size===1 ? "" : "s"}`}</span></div><div className="cc-view-switch" aria-label="Display mode">{(['posters','compact'] as View[]).map(v => <button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={() => setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div></div>
        <div className="cc-datebar"><div className="cc-date-shortcuts"><button aria-label="Previous day" onClick={() => chooseDate(shiftDate(filters.startDate || getCurrentDateInAmsterdam(),-1))}><ArrowLeft size={16}/></button><button className={filters.startDate===getCurrentDateInAmsterdam() && filters.endDate===filters.startDate?'active':''} onClick={() => chooseDate(getCurrentDateInAmsterdam())}>Today</button><button className={filters.startDate===shiftDate(getCurrentDateInAmsterdam(),1) && filters.endDate===filters.startDate?'active':''} onClick={() => chooseDate(shiftDate(getCurrentDateInAmsterdam(),1))}>Tomorrow</button><button aria-label="Next day" onClick={() => chooseDate(shiftDate(filters.startDate || getCurrentDateInAmsterdam(),1))}><ArrowRight size={16}/></button></div><span>{dateLabel(filters.startDate || getCurrentDateInAmsterdam())}{filters.endDate!==filters.startDate && filters.endDate ? ` – ${dateLabel(filters.endDate)}` : ''}</span></div>
        {selected && <div className="cc-planner"><div><strong>After {selected.movie.title}</strong><span>Next screening from {screeningTime(new Date(anchor || 0).toISOString())}</span></div><label>Travel buffer <input aria-label="Travel buffer minutes" type="number" min="0" max="180" value={buffer} onChange={e => setPlannerPrefs(p => ({...p,buffer:Math.min(180,Math.max(0,Number(e.target.value)))}))}/> min</label><div className="cc-availability-mode" aria-label="Availability display"><button aria-pressed={!hideUnavailable} onClick={() => setPlannerPrefs(p => ({...p,hideUnavailable:false}))}>Highlight available</button><button aria-pressed={hideUnavailable} onClick={() => setPlannerPrefs(p => ({...p,hideUnavailable:true}))}>Hide unavailable</button></div><label><input type="checkbox" checked={hideSameMovie} onChange={e => setPlannerPrefs(p => ({...p,hideSameMovie:e.target.checked}))}/> Hide other showtimes of this movie</label><button aria-label="Clear starting point" onClick={() => setSelected(null)}><X size={17}/></button></div>}
        <div aria-busy={loading}>
        {invalidRange ? <div className="cc-empty"><h3>Check your time window.</h3><p>The end date and time should come after the start.</p></div> : error ? <div className="cc-empty" role="alert"><h3>A brief intermission.</h3><p>{error}</p><button className="cc-primary" onClick={() => setRetry(v => v+1)}>Try again</button></div> : loading ? <div className="cc-loading" role="status"><div/><p>Gathering the programme…</p></div> : !visible.length ? <div className="cc-empty"><h3>No screenings in this window.</h3><p>Try a different date, cinema, or language.</p><button className="cc-primary" onClick={reset}>Reset filters</button></div> : Object.entries(groups).map(([date,items]) => <section key={date} className={`cc-day cc-${view}`} aria-label={dateLabel(date)}>{Object.keys(groups).length > 1 && <h3 className="cc-day-label">{dateLabel(date)}</h3>}{view==='compact' && <div className="cc-table-head" aria-hidden="true"><span>Start / end</span><span>Film / duration</span><span>Cinema</span><span>Language / subtitles</span><span>Save</span></div>}{items.map(s => <ScreeningRow key={s.showtime.id} screening={s} compact={view!=='posters'} saved={saved.some(item => item.showtimeId===s.showtime.id)} selected={selected?.showtime.id===s.showtime.id} unavailable={blocked(s)} available={Boolean(selected && s.showtime.id!==selected.showtime.id && !blocked(s) && !hideUnavailable)} onSave={() => toggleSave(s)} onSelect={() => setSelected(prev => prev?.showtime.id===s.showtime.id ? null : s)} onDetails={() => setDetails(s)} onPlan={() => setSelected(s)} onHide={() => hideMovie({id:s.movie.id,title:s.movie.title,year:s.movie.releaseYear})}/>)}</section>)}
        </div><footer className="cc-programme-footer"><span>Programme from Cineville · All times in Amsterdam</span><span>Pick a time to plan a double bill.</span></footer>
      </section></div></>}
    </main>{settingsOpen && <SettingsModal hidden={hidden} onRestore={id => updateHidden(hidden.filter(m => m.id !== id))} onClose={() => setSettingsOpen(false)}/>}
    {details && <FilmDetails screening={details} cities={cities} city={filters.selectedCity} saved={saved} onSave={toggleSave} onPlan={planScreening} onClose={() => setDetails(null)} onHide={() => hideMovie({id:details.movie.id,title:details.movie.title,year:details.movie.releaseYear})}/>}
  </div>;
}
