import React, { useState } from 'react';
import { Film, Plus } from 'lucide-react';
import { isBuiltInList, watchedListId, watchlistId } from '../lib/movieLists';
import { formatDuration, languageName } from '../lib/schedule';
import useMovieLists from '../lib/useMovieLists';
import useWatchedPosters from '../lib/useWatchedPosters';
import { SavedFilm } from '../types/Movie';
import MovieListAction from './MovieListAction';
import ScreeningReminder from './ScreeningReminder';
import './MovieLists.css';

type Props = {
  store: ReturnType<typeof useMovieLists>;
  visibleWatchlist: SavedFilm[];
  isWatched: (film: SavedFilm) => boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onBrowse: () => void;
  onWatchlist: () => void;
};

type FilmProps = {film: SavedFilm; removeLabel: string; onRemove: () => void; onPosterError?: (film: SavedFilm) => void};

function ListFilm({film, removeLabel, onRemove, onPosterError}: FilmProps) {
  const [failedPoster, setFailedPoster] = useState<string>();
  const metadata = [film.year, film.duration ? formatDuration(film.duration) : '', film.spokenLanguages?.map(languageName).join(', ')].filter(Boolean);
  return <li className="cc-list-film">
    <div className="cc-list-film-art">
      {film.posterPath && film.posterPath !== failedPoster
        ? <img key={film.posterPath} src={film.posterPath} alt="" loading="lazy" onError={() => {
          setFailedPoster(film.posterPath);
          onPosterError?.(film);
        }}/>
        : <Film size={22} aria-hidden="true"/>}
    </div>
    <div className="cc-list-film-copy">
      <h4>{film.title}</h4>
      {metadata.length > 0 && <p>{metadata.join(' · ')}</p>}
      {!!film.directors?.length && <p>Directed by {film.directors.join(', ')}</p>}
      {(film.overview || !!film.cast?.length) && <details>
        <summary>Film details</summary>
        {film.overview && <p>{film.overview}</p>}
        {!!film.cast?.length && <p>Cast {film.cast.join(', ')}</p>}
      </details>}
    </div>
    <div className="cc-list-film-actions">
      <MovieListAction film={film}/>
      <ScreeningReminder id={film.id} title={film.title} spokenLanguages={film.spokenLanguages} subtitleLanguages={film.availableSubtitles}/>
      <button className="cc-text-button" aria-label={`${removeLabel} ${film.title}`} onClick={onRemove}>{removeLabel}</button>
    </div>
  </li>;
}

export default function MovieLists({store, visibleWatchlist, isWatched, selectedId, onSelect, onBrowse, onWatchlist}: Props) {
  const [editing, setEditing] = useState<'create' | 'rename' | null>(null);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lists = store.lists.map(list => ({
    ...list,
    visibleFilms: list.id === watchlistId ? visibleWatchlist :
      list.hideWatched ? list.films.filter(film => !isWatched(film)) : list.films,
  }));
  const selected = lists.find(list => list.id === selectedId) ?? lists[0];
  const films = selected.visibleFilms;
  const showingWatched = selected.id === watchedListId;
  const reportBrokenPoster = useWatchedPosters(showingWatched ? films : undefined, store.update);
  const allWatched = selected.hideWatched && selected.films.length > 0 && films.length === 0;
  const chooseList = (id: string) => {
    onSelect(id);
    setEditing(null);
    setConfirmDelete(false);
  };

  return <section className="cc-subpage cc-movie-lists" aria-labelledby="cc-lists-heading">
    <header className="cc-page-header">
      <h2 id="cc-lists-heading">Lists</h2>
      <button className="cc-primary" onClick={() => {setEditing('create'); setName(''); setConfirmDelete(false);}}><Plus size={16}/> New list</button>
    </header>
    <div className="cc-lists-layout">
      <nav className="cc-list-index" aria-label="Movie lists">
        {lists.map(list => <button key={list.id} aria-current={selected.id === list.id ? 'true' : undefined}
          onClick={() => chooseList(list.id)}>
          <span>{list.name}</span><span className="cc-count">{list.visibleFilms.length}</span>
        </button>)}
      </nav>
      <select className="cc-list-select" aria-label="Movie list" value={selected.id}
        onChange={event => chooseList(event.target.value)}>
        {lists.map(list => <option key={list.id} value={list.id}>{list.name} ({list.visibleFilms.length})</option>)}
      </select>
      <section className="cc-list-content" aria-labelledby="cc-list-title">
        {editing && <form className="cc-list-editor" aria-label={editing === 'create' ? 'New movie list' : 'Rename movie list'} onSubmit={event => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          const id = editing === 'create' ? store.create(trimmed) : store.rename(selected.id, trimmed) && selected.id;
          if (id) {onSelect(id); setEditing(null);}
        }}>
          <label>List name <input autoFocus required value={name} onChange={event => setName(event.target.value)}/></label>
          <button className="cc-primary" type="submit" disabled={!name.trim()}>{editing === 'create' ? 'Create list' : 'Save name'}</button>
          <button type="button" className="cc-text-button" onClick={() => setEditing(null)}>Cancel</button>
        </form>}
        <header className="cc-list-content-heading">
          <h3 id="cc-list-title">{selected.name}</h3>
          <div className="cc-list-preferences">
            <ScreeningReminder id={selected.id} title={selected.name} list
              spokenLanguages={films.flatMap(film => film.spokenLanguages ?? [])}
              subtitleLanguages={films.flatMap(film => film.availableSubtitles ?? [])}/>
            {selected.id === watchlistId && <button className="cc-text-button" onClick={onWatchlist}>Open Watchlist</button>}
            {!isBuiltInList(selected.id) && <label className="cc-list-filter">
              <input type="checkbox" checked={selected.hideWatched ?? false}
                onChange={event => store.setHideWatched(selected.id, event.target.checked)}/>
              Hide watched
            </label>}
          </div>
          {!isBuiltInList(selected.id) && <div className="cc-list-management">
            <button className="cc-text-button" onClick={() => {setEditing('rename'); setName(selected.name); setConfirmDelete(false);}}>Rename list</button>
            <button className="cc-text-button" onClick={() => {setConfirmDelete(true); setEditing(null);}}>Delete list</button>
          </div>}
        </header>
        {confirmDelete && <div className="cc-list-editor" role="group" aria-label="Confirm list deletion">
          <p>Delete “{selected.name}”?</p>
          <button className="cc-primary" onClick={() => {
            if (store.remove(selected.id)) {onSelect(watchlistId); setConfirmDelete(false);}
          }}>Confirm delete</button>
          <button className="cc-text-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>}
        {films.length > 0 ? <ul className="cc-list-films">
          {films.map(film => <ListFilm key={film.id} film={film} removeLabel={showingWatched ? 'Restore' : 'Remove'}
            onPosterError={showingWatched ? reportBrokenPoster : undefined}
            onRemove={() => store.removeFilm(selected.id, film.id)}/>)}
        </ul> : <div className="cc-empty">
          <Film size={28} aria-hidden="true"/>
          <h4>{allWatched ? 'All films in this list are watched' : selected.id === watchedListId ? 'No watched films yet' : 'No films in this list yet'}</h4>
          {!allWatched && <button className="cc-text-button" onClick={onBrowse}>Search for films</button>}
        </div>}
      </section>
    </div>
  </section>;
}
