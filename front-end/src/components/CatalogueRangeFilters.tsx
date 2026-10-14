import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Movie } from '../types/Movie';
import { catalogueRangeFields, catalogueRangeValues, CatalogueRanges } from '../lib/catalogueFilters';
const dates = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Amsterdam'});
export default function CatalogueRangeFilters({movies,ranges,onChange,onClear}:{movies:Movie[];ranges:CatalogueRanges;onChange:(ranges:CatalogueRanges)=>void;onClear:()=>void}) {
  const available = useMemo(() => catalogueRangeValues(movies),[movies]);
  return <details className="cc-catalogue-range-filters">
    <summary>Filters <ChevronDown size={15} aria-hidden="true"/></summary>
    <div className="cc-catalogue-range-grid">{catalogueRangeFields.map(({key,label,type,from,to}) => <fieldset key={key}><legend>{label}</legend><div className="cc-field-pair">{(['min','max'] as const).map(bound => {
      const selected = ranges[key][bound];
      const options = selected && !available[key].includes(selected) ? [...available[key],selected].sort((a,b) => type === 'number' ? Number(a)-Number(b) : a.localeCompare(b)) : available[key];
      return <label key={bound} className="cc-field"><span>{bound === 'min' ? 'From' : 'To'}</span><select aria-label={bound === 'min' ? from : to} value={selected} onChange={event => onChange({...ranges,[key]:{...ranges[key],[bound]:event.target.value}})}><option value="">Any</option>{options.map(value => <option key={value} value={value}>{type === 'date' ? dates.format(new Date(`${value}T12:00:00Z`)) : key === 'duration' ? `${value} min` : value}</option>)}</select></label>;
    })}</div></fieldset>)}</div>
    <button className="cc-text-button" onClick={onClear}>Clear filters</button>
  </details>;
}
