import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { City, Movie, SavedFilm, SavedShowtime } from '../types/Movie';
import { Screening } from '../lib/schedule';
import MovieGroupSummary from './MovieGroupSummary';
import FilmDescription from './FilmDescription';
import FilmShowtimes from './FilmShowtimes';


export type CatalogueProps = {films:SavedFilm[];isHidden:(movie:Movie)=>boolean;cities:City[];city:string|null;saved:SavedShowtime[];onToggleFilm:(movie:Movie)=>void;onHide:(movie:Movie)=>void;onSave:(screening:Screening)=>void;onPlan:(screening:Screening)=>void};
export default function CatalogueFilm({movie,label,releaseLabel,...props}:CatalogueProps & {movie:Movie;label:string;releaseLabel?:string}) {
  const [showtimesOpen,setShowtimesOpen] = useState(false);
  const showtimesId = useId();
  return <article className="cc-upcoming-film" aria-label={`${label} ${movie.title}`}>
    <MovieGroupSummary movie={movie} compact={false} releaseLabel={releaseLabel} saved={props.films.some(film => film.id === movie.id)} description={<FilmDescription movie={movie}/>} onToggleFilm={() => props.onToggleFilm(movie)} onHide={() => props.onHide(movie)}/>
    <div className="cc-upcoming-actions">
      <button className="cc-watchlist-showtimes" aria-expanded={showtimesOpen} aria-controls={showtimesId} onClick={() => setShowtimesOpen(value => !value)}>{showtimesOpen ? 'Hide showtimes' : 'Find showtimes'} <ChevronDown size={14}/></button>
    </div>
    <div id={showtimesId} hidden={!showtimesOpen}>{showtimesOpen && <FilmShowtimes movieId={movie.id} movieTitle={movie.title} cities={props.cities} initialCity={props.city} saved={props.saved} onSave={props.onSave} onPlan={props.onPlan} onHide={props.onHide}/>}</div>
  </article>;
}
