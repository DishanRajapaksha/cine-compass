import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Movie } from '../types/Movie';
import { movieService } from '../services/movieService';
import CatalogueFilm, { CatalogueProps } from './CatalogueFilm';
import './FilmSearch.css';

export default function FilmSearch(props: CatalogueProps) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function search(title: string, cursor?: string) {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    if (!cursor) {
      setQuery(title);
      setMovies([]);
      setNextCursor(null);
    }
    setLoading(true);
    setFailed(false);
    try {
      const page = await movieService.searchFilms(title, cursor, request.signal);
      if (request.signal.aborted) return;
      setMovies(previous => {
        const byId = new Map(previous.map(movie => [movie.id, movie]));
        for (const movie of page.results) byId.set(movie.id, movie);
        return Array.from(byId.values());
      });
      setNextCursor(page.nextCursor);
    } catch {
      if (!request.signal.aborted) setFailed(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return <section className="cc-subpage cc-film-search" aria-labelledby="film-search-heading">
    <header className="cc-page-header"><h2 id="film-search-heading">Search films</h2></header>
    <form className="cc-film-search-form" role="search" onSubmit={event => {
      event.preventDefault();
      const title = input.trim();
      if (title) void search(title);
    }}>
      <label className="cc-search">
        <Search size={17} aria-hidden="true"/>
        <input type="search" aria-label="Film title" placeholder="Enter a film title…" maxLength={120}
          value={input} onChange={event => setInput(event.target.value)}/>
      </label>
      <button type="submit" className="cc-primary" disabled={!input.trim()}>Search</button>
    </form>
    <div role="status" className="cc-programme-count">
      {loading ? 'Searching Cineville…' : !query || failed ? '' : movies.length
        ? `Showing ${movies.length} film${movies.length === 1 ? '' : 's'} for “${query}”`
        : nextCursor ? 'More results are available.' : `No films found for “${query}”.`}
    </div>
    {movies.map(movie => <CatalogueFilm key={movie.id} {...props} movie={movie} label="Search result"/>)}
    {failed && <div className="cc-error" role="alert">
      {nextCursor ? 'More results could not be loaded.' : 'Film search could not be loaded.'}{' '}
      <button className="cc-text-button" onClick={() => void search(query, nextCursor ?? undefined)}>Try again</button>
    </div>}
    {nextCursor && !failed && <button className="cc-primary" disabled={loading}
      onClick={() => void search(query, nextCursor)}>Show more results</button>}
  </section>;
}
