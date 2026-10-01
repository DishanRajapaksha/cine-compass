import React, { useState } from 'react';
import { getOmdbKey, setOmdbKey } from '../services/imdbService';

export default function ImdbSettings() {
  const [key,setKey] = useState(getOmdbKey);
  const [message,setMessage] = useState('');
  return <div className="cc-imdb-settings">
    <form onSubmit={e => {e.preventDefault(); try {setOmdbKey(key);setMessage(key.trim() ? 'IMDb lookups enabled.' : 'IMDb lookups disabled.');} catch {setMessage('Browser storage is unavailable. Your key could not be saved.');}}}>
      <label className="cc-field">OMDb API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.currentTarget.value)}/></label>
      <p>Stored only in this browser. Film titles and your key are sent to OMDb to find IMDb pages and ratings.</p>
      <button type="submit" className="cc-primary">Save key</button> <button type="button" onClick={() => {try {setOmdbKey('');setKey('');setMessage('IMDb lookups disabled.');} catch {setMessage('Browser storage is unavailable.');}}}>Remove key</button>
      {message && <p role="status">{message}</p>}
    </form>
  </div>;
}
