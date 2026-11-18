import React, { useState } from 'react';
import { cinemaListsKey, setPreference } from '../lib/accountStorage';
import { readStorage } from '../lib/schedule';
import './CinemaLists.css';

type CinemaList = { name: string; theaterIds: string[] };
type Props = { selected: string[]; loading: boolean; onApply: (theaterIds: string[]) => void };

const validLists = (value: unknown): value is CinemaList[] =>
  Array.isArray(value) && value.every(list =>
    typeof list?.name === 'string' && Boolean(list.name.trim()) &&
    Array.isArray(list.theaterIds) && list.theaterIds.length > 0 &&
    list.theaterIds.every((id: unknown) => typeof id === 'string' && id.length > 0));

export default function CinemaLists({ selected, loading, onApply }: Props) {
  const [lists, setLists] = useState(() => readStorage(cinemaListsKey, [], validLists));
  const [activeName, setActiveName] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const active = lists.find(list => list.name === activeName);
  const matches = active?.theaterIds.length === selected.length &&
    active.theaterIds.every(id => selected.includes(id));
  const canSave = !loading && selected.length > 0;

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!canSave || !trimmedName) return;
    if (lists.some(list => list.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('A cinema list already has that name.');
      return;
    }
    const next = [...lists, { name: trimmedName, theaterIds: selected }];
    try {
      setPreference(cinemaListsKey, JSON.stringify(next));
    } catch {
      setError('This device could not save the cinema list.');
      return;
    }
    setLists(next);
    setActiveName(trimmedName);
    closeForm();
  }

  function closeForm() {
    setCreating(false);
    setName('');
    setError('');
  }

  return <div className="cc-cinema-lists">
    <label className="cc-field">Cinema lists
      <select value={matches ? activeName : ''} disabled={loading || lists.length === 0} onChange={event => {
        const list = lists.find(item => item.name === event.currentTarget.value);
        if (!list) return;
        setActiveName(list.name);
        onApply(list.theaterIds);
      }}>
        <option value="" disabled>{lists.length ? 'Choose a saved list' : 'No saved lists'}</option>
        {lists.map(list => <option key={list.name} value={list.name}>{list.name}</option>)}
      </select>
    </label>
    {creating ? <form onSubmit={save}>
      <label className="cc-field">List name<input autoFocus value={name} required maxLength={80}
        onChange={event => { setName(event.currentTarget.value); setError(''); }}/></label>
      {error && <p className="cc-error" role="alert">{error}</p>}
      <div className="cc-cinema-list-actions">
        <button type="submit" className="cc-text-button" disabled={!canSave || !name.trim()}>Save list</button>
        <button type="button" className="cc-text-button" onClick={closeForm}>Cancel</button>
      </div>
    </form> : <button type="button" className="cc-text-button" disabled={!canSave} onClick={() => setCreating(true)}>
      Save selected cinemas
    </button>}
    {!canSave && !loading && <small className="cc-hint">Select cinemas above to create a list.</small>}
  </div>;
}
