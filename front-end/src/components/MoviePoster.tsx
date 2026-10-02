import React, { useState } from 'react';
import { Movie } from '../types/Movie';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface MoviePosterProps {
  movie: Movie;
  onClick?: (movie: Movie) => void;
  onHover?: (movie: Movie | null) => void;
}

const MoviePoster: React.FC<MoviePosterProps> = ({ movie, onClick, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(movie);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onHover) {
      onHover(movie);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Don't call onHover(null) to prevent flashing
  };

  const getYear = (dateString: string) => {
    if (!dateString) return '';
    const parsed = new Date(dateString);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.getFullYear();
  };

  const fallbackImage = 'https://via.placeholder.com/300x450/333333/ffffff?text=No+Image';

  return (
    <Card
      className="group relative h-full overflow-hidden rounded-xl border-slate-200 bg-white/70 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="relative aspect-[2/3] w-full">
        <img
          src={imageError ? fallbackImage : movie.poster_path}
          alt={movie.title}
          onError={handleImageError}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div
          className={cn(
            'absolute inset-0 flex items-end bg-gradient-to-b from-transparent via-black/10 to-black/80 p-4 transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="space-y-1 text-white drop-shadow-lg">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{movie.title}</h3>
            <p className="text-xs text-slate-200/90">{getYear(movie.release_date)}</p>
            <Badge className="bg-white/90 text-slate-900 shadow-sm backdrop-blur" variant="secondary">
              <span className="mr-1 text-amber-500">★</span>
              {movie.vote_average.toFixed(1)}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MoviePoster;
