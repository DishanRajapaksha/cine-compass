import React, { useEffect, useMemo, useState } from 'react';
import { City, Movie, MovieFilters, SavedShowtime } from '../types/Movie';
import { movieService } from '../services/movieService';
import { getCurrentDateInAmsterdam, normalizeLanguageCode } from '../lib/utils';
import { amsterdamDate, dateLabel, filterScreenings, Screening } from '../lib/schedule';
import ScreeningRow from './ScreeningRow';
import ScheduleFilters from './ScheduleFilters';

type Props = { onHide?: (movie: Movie) => void; movieId: string; movieTitle: string; cities: City[]; initialCity: string | null; saved: SavedShowtime[]; onSave: (screening: Screening) => void; onPlan: (screening: Screening) => void };
export default function FilmShowtimes({movieId,movieTitle,cities,initialCity,saved,onSave,onPlan,onHide}: Props) {
  const defaults = (): MovieFilters => ({selectedCity:initialCity,selectedTheaters:[],selectedSubtitleLanguages:['en'],selectedSpokenLanguages:['en'],languageMatchMode:'any',selectedSpecials:[],startDate:getCurrentDateInAmsterdam(),endDate:null,startTime:null,endTime:null});
  const [filters,setFilters] = useState<MovieFilters>(defaults);
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [film,setFilm] = useState<Movie | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const invalid = Boolean((filters.endDate && filters.startDate && filters.startDate > filters.endDate) || (filters.startTime && filters.endTime && filters.startTime > filters.endTime));
  const sourceFilters = useMemo<MovieFilters>(() => ({selectedCity:filters.selectedCity,selectedTheaters:[],selectedSubtitleLanguages:[],selectedSpokenLanguages:[],selectedSpecials:[],startDate:filters.startDate,endDate:filters.endDate,startTime:null,endTime:null}),[filters.selectedCity,filters.startDate,filters.endDate]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    movieService.getMovieShowtimes(movieId,sourceFilters).then(result => {if(active) setFilm(result);}).catch(() => {if(active) setError('Showtimes could not be loaded.');}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  }, [movieId,sourceFilters,retry]);
  const languages = Array.from(new Set([...(film?.spokenLanguages || []).map(normalizeLanguageCode),...filters.selectedSpokenLanguages])).sort();
  const specials = Array.from(new Set([...(film?.showtimes || []).flatMap(st => st.specials?.split(',').map(s => s.trim()).filter(Boolean) || []),...filters.selectedSpecials])).sort();
  const screenings = invalid ? [] : filterScreenings(film ? [film] : [],filters,'').filter(s => Date.parse(s.showtime.startDate) >= Date.now());
  const groups = screenings.reduce<Record<string,Screening[]>>((map,s) => {(map[amsterdamDate(s.showtime.startDate)] ||= []).push(s); return map;},{});
  return <section className="cc-film-showtimes" aria-label={`All showtimes for ${movieTitle}`}>
    <div className="cc-showtimes-heading"><h3>All showtimes</h3><button className="cc-text-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}>{filtersOpen ? 'Hide showtime filters' : 'Filter showtimes'}</button></div>
    <p className="cc-showtime-scope">All published upcoming screenings for this film. These filters are independent of the main schedule.</p>
    <div className={`cc-film-showtime-layout ${filtersOpen ? 'with-filters' : ''}`}>
      {filtersOpen && <ScheduleFilters filters={filters} cities={cities} query="" showSearch={false} languages={languages} specials={specials} loading={false} onQuery={() => {}} onChange={setFilters} onReset={() => setFilters(defaults())}/>}
      <div className="cc-film-showtime-results" aria-busy={loading}>
        {invalid ? <p role="alert">The end date and time should come after the start.</p> : loading ? <p role="status">Finding all showtimes…</p> : error ? <p role="alert">{error} <button className="cc-text-button" onClick={() => setRetry(v => v+1)}>Retry</button></p> : !screenings.length ? <p>No upcoming showtimes match these filters. Try another city, date, or language.</p> : <><p className="cc-showtime-count" aria-live="polite">{screenings.length} screening{screenings.length===1 ? '' : 's'}</p><div className="cc-all-showtimes">{Object.entries(groups).map(([date,items]) => <section key={date} aria-label={dateLabel(date)}><h4 className="cc-day-label">{dateLabel(date)}</h4>{items.map(s => <ScreeningRow key={s.showtime.id} screening={s} compact saved={saved.some(savedShowtime => savedShowtime.showtimeId===s.showtime.id)} selected={false} unavailable={false} onSave={() => onSave(s)} onSelect={() => onPlan(s)} onDetails={() => onPlan(s)} onPlan={() => onPlan(s)} onHide={onHide ? () => onHide(s.movie) : undefined}/>)}</section>)}</div></>}
      </div>
    </div>
  </section>;
}
