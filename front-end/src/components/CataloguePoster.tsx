import React, { useState } from 'react';
import { Film } from 'lucide-react';
import { Movie } from '../types/Movie';
export default function CataloguePoster({movie,label,releaseLabel,onOpen}:{movie:Movie;label:string;releaseLabel?:string;onOpen:()=>void}) {
  const [failed,setFailed] = useState(false);
  return <article className="cc-catalogue-poster" aria-label={`${label} ${movie.title}`}>
    <button onClick={onOpen} aria-label={`Details for ${movie.title}`} aria-haspopup="dialog">
      <span className="cc-catalogue-poster-art">{movie.poster_path && !failed ? <img src={movie.poster_path} alt={`${movie.title} poster`} loading="lazy" onError={() => setFailed(true)}/> : <Film size={36} aria-hidden="true"/>}</span>
      <span className="cc-catalogue-poster-title">{movie.title}</span>
      {releaseLabel && <small>{releaseLabel}</small>}
    </button>
  </article>;
}
