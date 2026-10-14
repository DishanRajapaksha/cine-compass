import React from 'react';
import { ChevronDown } from 'lucide-react';
import { catalogueRangeFields, CatalogueRanges } from '../lib/catalogueFilters';
export default function CatalogueRangeFilters({ranges,onChange,onClear}:{ranges:CatalogueRanges;onChange:(ranges:CatalogueRanges)=>void;onClear:()=>void}) {
  return <details className="cc-catalogue-range-filters">
    <summary>Filters <ChevronDown size={15} aria-hidden="true"/></summary>
    <div className="cc-catalogue-range-grid">{catalogueRangeFields.map(({key,label,type,from,to}) => <fieldset key={key}><legend>{label}</legend><div className="cc-field-pair">{(['min','max'] as const).map(bound => <label key={bound} className="cc-field"><span>{bound === 'min' ? 'From' : 'To'}</span><input type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} aria-label={bound === 'min' ? from : to} value={ranges[key][bound]} onChange={event => onChange({...ranges,[key]:{...ranges[key],[bound]:event.target.value}})}/></label>)}</div></fieldset>)}</div>
    <button className="cc-text-button" onClick={onClear}>Clear filters</button>
  </details>;
}
