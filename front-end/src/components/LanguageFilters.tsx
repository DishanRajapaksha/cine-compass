import React, { useId } from 'react';
import { languageName } from '../lib/schedule';
import { LanguageFilterValues } from '../types/Movie';

type Props = {
  filters: LanguageFilterValues;
  languages: string[];
  subtitleLanguages?: string[];
  onChange: (patch: Partial<LanguageFilterValues>) => void;
};

export default function LanguageFilters({filters, languages, subtitleLanguages = [], onChange}: Props) {
  const id = useId();
  const any = filters.languageMatchMode === 'any';
  const subtitles = Array.from(new Set(['en', 'nl', ...subtitleLanguages, ...filters.selectedSubtitleLanguages]));
  return <>
    <fieldset className="cc-language-match">
      <legend>Language matching</legend>
      <div className="cc-language-mode" aria-label="Language filter matching">
        <button type="button" aria-pressed={any} onClick={() => onChange({languageMatchMode:'any'})}>Any (OR)</button>
        <button type="button" aria-pressed={!any} onClick={() => onChange({languageMatchMode:'all'})}>All (AND)</button>
      </div>
      <small className="cc-hint">{any ? 'Match the subtitle or spoken language.' : 'Match both selected language filters.'}</small>
    </fieldset>
    <label className="cc-field" htmlFor={`${id}-subtitles`}>Subtitles
      <select id={`${id}-subtitles`} value={filters.selectedSubtitleLanguages[0] || ''}
        onChange={e => onChange({selectedSubtitleLanguages:e.currentTarget.value ? [e.currentTarget.value] : []})}>
        <option value="">Any subtitles</option>
        {subtitles.map(lang => <option key={lang} value={lang}>{languageName(lang)} subtitles</option>)}
      </select>
    </label>
    <label className="cc-field" htmlFor={`${id}-spoken`}>Spoken language
      <select id={`${id}-spoken`} value={filters.selectedSpokenLanguages[0] || ''}
        onChange={e => onChange({selectedSpokenLanguages:e.currentTarget.value ? [e.currentTarget.value] : []})}>
        <option value="">Any language</option>
        {languages.map(lang => <option key={lang} value={lang}>{languageName(lang)}</option>)}
      </select>
    </label>
  </>;
}
