import { HiddenMovie } from '../types/Movie';
type MovieIdentity = {id:string;title:string;releaseYear?:number;year?:number};
const punctuation = new RegExp('[^\\p{L}\\p{N}]+','gu');
function movieTitle(title:string):string {
  return title.replace(/\s*[([](?:re[\s-]?release|re[\s-]?issue)(?:\s+\d{4})?[)\]]\s*$/i,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(punctuation,' ').trim();
}
const movieId = (id:string) => /^[0-9a-f-]{36}$/i.test(id.trim()) ? id.trim().toLowerCase() : id;
function titleYear(movie:MovieIdentity):string|undefined {
  const year=movie.releaseYear || movie.year;
  const title=movieTitle(movie.title);
  return title && year && Number.isFinite(year) && year>0 ? `${title}\u0000${year}` : undefined;
}
export function createHiddenMovieMatcher(hidden:HiddenMovie[]):(movie:MovieIdentity)=>boolean {
  const ids=new Set(hidden.map(movie=>movieId(movie.id)));
  const films=new Set(hidden.map(titleYear).filter((key):key is string=>key !== undefined));
  return movie => ids.has(movieId(movie.id)) || films.has(titleYear(movie) || '');
}
