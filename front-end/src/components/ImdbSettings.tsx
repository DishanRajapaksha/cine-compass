import React, { useId, useState } from 'react';
import { api } from '../services/accountService';
import { getOmdbKey, setOmdbKey } from '../services/imdbService';
import { useAccount } from './AccountProvider';

export default function ImdbSettings() {
  const account = useAccount();
  const userId = account?.user?.id;
  const [key,setKey] = useState('');
  const [hasBrowserKey,setHasBrowserKey] = useState(() => Boolean(getOmdbKey()));
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const id = useId();
  const saved = userId ? Boolean(account?.omdb.enabled) : hasBrowserKey;

  const save = async (next: string | null) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (userId) {
        await api('/imdb/key','PUT',{userId,key:next});
        account?.setOmdbEnabled(userId, next !== null);
      } else {
        setOmdbKey(next ?? '');
        setHasBrowserKey(next !== null);
      }
      setKey('');
      setMessage(next ? 'OMDb key saved.' : 'OMDb key removed.');
    } catch (failure) {
      setError(userId ? (failure as Error).message : 'Browser storage is unavailable.');
    } finally { setBusy(false); }
  };

  return <div className="cc-imdb-settings">
    <p>{userId
      ? 'Save a key to your account to look up IMDb pages and ratings across devices.'
      : 'Save a key on this device to look up IMDb pages and ratings.'}</p>
    <form onSubmit={event => {event.preventDefault(); if (key.trim() && !busy) void save(key.trim());}}>
      <div className="cc-field">
        <label htmlFor={id}>OMDb API key</label>
        <input id={id} type="password" autoComplete="new-password" maxLength={128}
          value={key} onChange={event => setKey(event.currentTarget.value)} aria-describedby={id + '-status'}/>
      </div>
      <p id={id + '-status'} role="status">
        {message || (saved ? 'Key saved.' : userId && hasBrowserKey ? 'Using the key saved on this device.' : 'No key saved.')}
      </p>
      <div className="cc-imdb-key-actions">
        <button type="submit" className="cc-primary" disabled={busy || !key.trim()}>Save key</button>
        {saved && <button type="button" className="cc-text-button" disabled={busy} onClick={() => void save(null)}>Remove key</button>}
        {userId && !saved && hasBrowserKey && <button type="button" className="cc-text-button" disabled={busy}
          onClick={() => {const browserKey = getOmdbKey(); if (browserKey) void save(browserKey);}}>Save device key to account</button>}
      </div>
      {error && <p role="alert" className="cc-error">{error}</p>}
    </form>
  </div>;
}
