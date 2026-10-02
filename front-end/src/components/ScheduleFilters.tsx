import React, { useEffect, useRef, useState, useId } from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { City, MovieFilters } from '../types/Movie';
import { languageName } from '../lib/schedule';

type Props = {
  filters: MovieFilters; cities: City[]; query: string; languages: string[]; specials: string[];
  showSearch?: boolean; loading: boolean; onQuery: (query: string) => void; onChange: (filters: MovieFilters) => void; onReset: () => void;
};
export default function ScheduleFilters({ filters, cities, query, languages, specials, loading, showSearch = true, onQuery, onChange, onReset }: Props) {
  const cinemaId = useId();
  const [cinemasOpen, setCinemasOpen] = useState(false);
  const [cinemaQuery, setCinemaQuery] = useState('');
  const dropdown = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (!dropdown.current?.contains(event.target as Node)) setCinemasOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);
  const update = (patch: Partial<MovieFilters>) => onChange({ ...filters, ...patch });
  const theaters = cities.filter(c => !filters.selectedCity || c.name === filters.selectedCity).flatMap(c => c.theaters);
  return <aside className="cc-filters" aria-label="Screening filters">
    <div className="cc-filter-heading"><h2><SlidersHorizontal size={18}/> Filters</h2><button className="cc-text-button" onClick={onReset}>Reset</button></div>
    {showSearch && <label className="cc-search"><Search size={17}/><input aria-label="Search films" placeholder="Search films…" value={query} onChange={e => onQuery(e.currentTarget.value)}/></label>}
    <label className="cc-field">City<select value={filters.selectedCity || ''} onChange={e => update({selectedCity:e.currentTarget.value || null, selectedTheaters:[]})}><option value="">All cities</option>{cities.map(city => <option key={city.name}>{city.name}</option>)}</select></label>
    <fieldset><legend>Date</legend><div className="cc-field-pair">
      <label className="cc-field cc-secondary-label">From<input type="date" value={filters.startDate || ''} onInput={e => update({startDate:e.currentTarget.value || null, endDate: e.currentTarget.value > (filters.endDate || '') ? e.currentTarget.value : filters.endDate})}/></label>
      <label className="cc-field cc-secondary-label">To<input type="date" min={filters.startDate || undefined} value={filters.endDate || ''} onInput={e => update({endDate:e.currentTarget.value || null})}/></label>
    </div></fieldset>
    <fieldset><legend>Start time</legend><div className="cc-field-pair">
      <label className="cc-field cc-secondary-label">After<input type="time" value={filters.startTime || ''} onInput={e => update({startTime:e.currentTarget.value || null})}/></label>
      <label className="cc-field cc-secondary-label">Before<input type="time" value={filters.endTime || ''} onInput={e => update({endTime:e.currentTarget.value || null})}/></label>
    </div></fieldset>
    <div className="cc-cinema-select" ref={dropdown} onKeyDown={e => { if(e.key === 'Escape') { setCinemasOpen(false); trigger.current?.focus(); } }}>
      <span id={`${cinemaId}-label`}>Cinemas</span>
      <button ref={trigger} className="cc-cinema-trigger" aria-labelledby={`${cinemaId}-label ${cinemaId}-value`} aria-expanded={cinemasOpen} aria-controls={`${cinemaId}-options`} onClick={() => setCinemasOpen(v => !v)} disabled={loading}>
        <span id={`${cinemaId}-value`}>{loading ? 'Loading cinemas…' : filters.selectedTheaters.length ? `${filters.selectedTheaters.length} selected` : 'All cinemas'}</span><ChevronDown size={15}/>
      </button>
      {cinemasOpen && <div id={`${cinemaId}-options`} className="cc-cinema-popover">
        <input autoFocus aria-label="Search cinemas" placeholder="Search cinemas…" value={cinemaQuery} onChange={e => setCinemaQuery(e.currentTarget.value)}/>
        <div className="cc-cinema-actions"><button onClick={() => update({selectedTheaters:theaters.map(t => t.id)})}>Select all</button><button onClick={() => update({selectedTheaters:[]})}>Clear</button></div>
        <div className="cc-cinemas">{theaters.filter(t => `${t.name} ${t.city}`.toLowerCase().includes(cinemaQuery.toLowerCase())).map(theater => <label key={theater.id}><input type="checkbox" checked={filters.selectedTheaters.includes(theater.id)} onChange={() => update({selectedTheaters:filters.selectedTheaters.includes(theater.id) ? filters.selectedTheaters.filter(id => id !== theater.id) : [...filters.selectedTheaters,theater.id]})}/><span>{theater.name}{!filters.selectedCity && <small>{theater.city}</small>}</span></label>)}</div>
        {!theaters.some(t => `${t.name} ${t.city}`.toLowerCase().includes(cinemaQuery.toLowerCase())) && <p>No cinemas found.</p>}
        <small className="cc-hint">No selection includes all cinemas.</small><button className="cc-cinema-done" onClick={() => {setCinemasOpen(false); trigger.current?.focus();}}>Done</button>
      </div>}
    </div>
    <fieldset className="cc-language-match"><legend>Language matching</legend><div className="cc-language-mode" aria-label="Language filter matching"><button aria-pressed={filters.languageMatchMode==='any'} onClick={() => update({languageMatchMode:'any'})}>Any (OR)</button><button aria-pressed={filters.languageMatchMode!=='any'} onClick={() => update({languageMatchMode:'all'})}>All (AND)</button></div><small className="cc-hint">{filters.languageMatchMode==='any' ? 'Match the subtitle or spoken language.' : 'Match both selected language filters.'}</small></fieldset>
    <label className="cc-field">Subtitles<select value={filters.selectedSubtitleLanguages[0] || ''} onChange={e => update({selectedSubtitleLanguages:e.currentTarget.value ? [e.currentTarget.value] : []})}><option value="">Any subtitles</option><option value="en">English subtitles</option><option value="nl">Dutch subtitles</option></select></label>
    <label className="cc-field">Spoken language<select value={filters.selectedSpokenLanguages[0] || ''} onChange={e => update({selectedSpokenLanguages:e.currentTarget.value ? [e.currentTarget.value] : []})}><option value="">Any language</option>{languages.map(lang => <option key={lang} value={lang}>{languageName(lang)}</option>)}</select></label>
    <label className="cc-field">Special screenings<select value={filters.selectedSpecials[0] || ''} onChange={e => update({selectedSpecials:e.currentTarget.value ? [e.currentTarget.value] : []})}><option value="">Any screening type</option>{specials.map(special => <option key={special}>{special}</option>)}</select></label>
  </aside>;
}
