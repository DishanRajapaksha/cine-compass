import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { WatchedMovie } from '../types/Movie';
import ImdbSettings from './ImdbSettings';
import AccountSettings from './AccountSettings';
import CalendarSubscription from './CalendarSubscription';

export default function SettingsModal({watched,onRestore,onClose}: {watched:WatchedMovie[];onRestore:(id:string) => void;onClose:() => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {const el=dialog.current;el?.showModal();return () => el?.close();},[]);
  return <dialog ref={dialog} className="cc-dialog cc-settings-dialog" aria-labelledby="cc-settings-title" onCancel={onClose} onClick={e => {if(e.target===e.currentTarget) onClose();}}>
    <header className="cc-settings-header">
      <h2 id="cc-settings-title">Settings</h2>
      <button className="cc-dialog-close" aria-label="Close settings" title="Close settings" onClick={onClose}><X size={22}/></button>
    </header>
    <div className="cc-settings-body">
    <AccountSettings/>
    <CalendarSubscription/>
    <section aria-labelledby="cc-imdb-title"><h3 id="cc-imdb-title">IMDb</h3><ImdbSettings/></section>
    <section aria-labelledby="cc-watched-title"><h3 id="cc-watched-title">Watched films <span>({watched.length})</span></h3>
      {watched.length ? <ul className="cc-watched-movies">{[...watched].sort((a,b) => a.title.localeCompare(b.title)).map(movie => <li key={movie.id}><span>{movie.title}{movie.year ? <small>{movie.year}</small> : null}</span><button className="cc-text-button" aria-label={`Restore ${movie.title}`} onClick={() => onRestore(movie.id)}>Restore</button></li>)}</ul> : <p>No watched films.</p>}
    </section>
    </div>
  </dialog>;
}
