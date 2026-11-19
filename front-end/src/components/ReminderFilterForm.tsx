import React, { useId, useState } from 'react';
import { maximumLookAheadDays, ReminderChoices, ReminderFilters, validLookAhead } from '../lib/screeningReminders';
import LanguageFilters from './LanguageFilters';

type Props = ReminderChoices & {
  value: ReminderFilters;
  onSave: (filters: ReminderFilters) => boolean;
  onReset?: () => void;
  error: string;
};

export default function ReminderFilterForm({value, cities, languages, subtitleLanguages, cityError, retryCities, onSave, onReset, error}: Props) {
  const id = useId();
  const [draft, setDraft] = useState<Partial<ReminderFilters>>({});
  const [draftDays, setDraftDays] = useState<string | null>(null);
  const days = draftDays ?? String(value.lookAheadDays);
  const filters = {...value, ...draft, lookAheadDays:Number(days)};
  const spoken = Array.from(new Set(['en', 'nl', ...languages, ...filters.selectedSpokenLanguages])).sort();
  const canSave = validLookAhead(filters.lookAheadDays) && (
    filters.lookAheadDays !== value.lookAheadDays || filters.city !== value.city ||
    filters.languageMatchMode !== value.languageMatchMode ||
    filters.selectedSpokenLanguages[0] !== value.selectedSpokenLanguages[0] ||
    filters.selectedSubtitleLanguages[0] !== value.selectedSubtitleLanguages[0]
  );

  return <form className="cc-reminder-filters" onSubmit={event => {
    event.preventDefault();
    if (canSave && onSave(filters)) {
      setDraft({});
      setDraftDays(null);
    }
  }}>
    <div className="cc-reminder-filter-row">
      <label className="cc-field" htmlFor={id + '-days'}>Look ahead (days)
        <input id={id + '-days'} type="number" min={1} max={maximumLookAheadDays} step={1} required
          value={days} onChange={event => setDraftDays(event.target.value)}/>
      </label>
      <label className="cc-field" htmlFor={id + '-city'}>City
        <select id={id + '-city'} value={filters.city ?? ''} onChange={event => setDraft(current => ({...current, city:event.target.value || null}))}>
          <option value="">All cities</option>
          {filters.city && !cities.some(entry => entry.name === filters.city) && <option value={filters.city}>{filters.city}</option>}
          {cities.map(({name}) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
    </div>
    {cityError && <p role="status">{cityError}{' '}
      <button className="cc-text-button" type="button" onClick={retryCities}>Retry</button>
    </p>}
    <div className="cc-reminder-filter-row">
      <LanguageFilters filters={filters} languages={spoken} subtitleLanguages={subtitleLanguages}
        onChange={patch => setDraft(current => ({...current, ...patch}))}/>
    </div>
    <div className="cc-reminder-filter-actions">
      <button type="submit" className="cc-primary" disabled={!canSave}>Save</button>
      {onReset && <button type="button" className="cc-text-button" onClick={onReset}>Use global filters</button>}
    </div>
    {error && <p role="alert">{error}</p>}
  </form>;
}
