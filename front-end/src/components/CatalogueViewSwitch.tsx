import React, { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/schedule';
export type CatalogueView = 'list'|'grid';
export function useCatalogueView() {
  const [view,setView] = useState<CatalogueView>(() => readStorage('cinecompass_catalogue_view','list' as CatalogueView,(value):value is CatalogueView => value === 'list' || value === 'grid'));
  useEffect(() => writeStorage('cinecompass_catalogue_view',view),[view]);
  return [view,setView] as const;
}
export default function CatalogueViewSwitch({view,onChange}:{view:CatalogueView;onChange:(view:CatalogueView)=>void}) {
  return <div className="cc-view-switch" role="group" aria-label="Catalogue display mode"><button aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => onChange('list')}>List</button><button aria-pressed={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => onChange('grid')}>Poster grid</button></div>;
}
