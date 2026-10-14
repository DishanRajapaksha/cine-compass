import { Movie } from '../types/Movie';
export const catalogueSortOptions = [
  {value:'title-asc',label:'Title: A–Z'},
  {value:'title-desc',label:'Title: Z–A'},
  {value:'release-asc',label:'Release date: oldest first'},
  {value:'release-desc',label:'Release date: newest first'},
  {value:'year-asc',label:'Release year: oldest first'},
  {value:'year-desc',label:'Release year: newest first'},
  {value:'duration-asc',label:'Runtime: shortest first'},
  {value:'duration-desc',label:'Runtime: longest first'},
  {value:'added-desc',label:'Added: newest first'},
  {value:'added-asc',label:'Added: oldest first'}
] as const;
export type CatalogueSort = typeof catalogueSortOptions[number]['value'];
const titles = new Intl.Collator('en',{sensitivity:'base',numeric:true});
const validNumber = (value:number) => Number.isFinite(value) && value > 0 ? value : null;
const dateValue = (value:string|undefined) => {const time=value ? Date.parse(value) : NaN;return Number.isFinite(time) ? time : null;};
export function sortCatalogue(movies:Movie[],sort:CatalogueSort):Movie[] {
  const descending = sort.endsWith('-desc');
  const value = (movie:Movie):number|null => sort.startsWith('release-') ? dateValue(movie.release_date) : sort.startsWith('added-') ? dateValue(movie.createdAt) : sort.startsWith('year-') ? validNumber(movie.releaseYear) : validNumber(movie.duration);
  return [...movies].sort((a,b) => {
    if (sort.startsWith('title-')) return titles.compare(a.title,b.title)*(descending ? -1 : 1);
    const av=value(a),bv=value(b);
    if (av === null || bv === null) return av === bv ? titles.compare(a.title,b.title) : av === null ? 1 : -1;
    return (av-bv)*(descending ? -1 : 1) || titles.compare(a.title,b.title);
  });
}
