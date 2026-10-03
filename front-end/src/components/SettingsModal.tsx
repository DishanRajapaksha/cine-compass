import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { HiddenMovie } from '../types/Movie';
import ImdbSettings from './ImdbSettings';
import AccountSettings from './AccountSettings';
import CalendarSubscription from './CalendarSubscription';

export default function SettingsModal({hidden,onRestore,onClose}: {hidden:HiddenMovie[];onRestore:(id:string) => void;onClose:() => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {const el=dialog.current;el?.showModal();return () => el?.close();},[]);
  return <dialog ref={dialog} className="cc-dialog cc-settings-dialog" aria-labelledby="cc-settings-title" onCancel={onClose} onClick={e => {if(e.target===e.currentTarget) onClose();}}>
    <header className="cc-settings-header">
      <h2 id="cc-settings-title">Settings</h2>
      <button className="cc-dialog-close" aria-label="Close settings" onClick={onClose}><X size={22}/></button>
    </header>
    <div className="cc-settings-body">
    <AccountSettings/>
    <CalendarSubscription/>
    <section aria-labelledby="cc-imdb-title"><h3 id="cc-imdb-title">IMDb</h3><ImdbSettings/></section>
    <section aria-labelledby="cc-hidden-title"><h3 id="cc-hidden-title">Hidden movies <span>({hidden.length})</span></h3>
      <p>Hidden movies stay out of the schedule and watchlist until you restore them. These choices are saved locally and sync when you sign in. Saved screenings are kept.</p>
      {hidden.length ? <ul className="cc-hidden-movies">{[...hidden].sort((a,b) => a.title.localeCompare(b.title)).map(movie => <li key={movie.id}><span>{movie.title}{movie.year ? <small>{movie.year}</small> : null}</span><button className="cc-text-button" aria-label={`Restore ${movie.title}`} onClick={() => onRestore(movie.id)}>Restore</button></li>)}</ul> : <p>No hidden movies.</p>}
    </section>
    </div>
  </dialog>;
}
