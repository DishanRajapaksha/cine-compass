import React from 'react';
import { Movie } from '../types/Movie';
import FilmDetails from './FilmDetails';
import { CatalogueProps } from './CatalogueFilm';
export default function CatalogueDetails({movie,releaseLabel,onClose,...props}:CatalogueProps & {movie:Movie;releaseLabel?:string;onClose:()=>void}) {
  return <FilmDetails movie={movie} releaseLabel={releaseLabel} initialShowtimesOpen cities={props.cities} city={props.city} saved={props.saved} filmSaved={props.films.some(film => film.id === movie.id)} onToggleFilm={() => props.onToggleFilm(movie)} onSave={props.onSave} onPlan={screening => {onClose();props.onPlan(screening);}} onClose={onClose} onHide={() => {onClose();props.onHide(movie);}}/>;
}
