import { Movie } from '../types/Movie';
import { amsterdamDate } from './schedule';
export const catalogueRangeFields = [
  {key:'release',label:'Release date',type:'date',from:'Released from',to:'Released until'},
  {key:'year',label:'Release year',type:'number',from:'From year',to:'Until year'},
  {key:'duration',label:'Runtime (minutes)',type:'number',from:'Minimum runtime',to:'Maximum runtime'},
  {key:'added',label:'Date added',type:'date',from:'Added from',to:'Added until'}
] as const;
export type RangeField = typeof catalogueRangeFields[number]['key'];
export type CatalogueRanges = Record<RangeField,{min:string;max:string}>;
export const emptyCatalogueRanges = ():CatalogueRanges => ({release:{min:'',max:''},year:{min:'',max:''},duration:{min:'',max:''},added:{min:'',max:''}});
export const hasCatalogueRanges = (ranges:CatalogueRanges) => catalogueRangeFields.some(({key}) => ranges[key].min || ranges[key].max);
export function invalidCatalogueRanges(ranges:CatalogueRanges):boolean {
  return catalogueRangeFields.some(({key,type}) => {
    const {min,max} = ranges[key];
    if (type === 'number') return [min,max].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) || Boolean(min && max && Number(min)>Number(max));
    return Boolean(min && max && min>max);
  });
}
export function filterCatalogue(movies:Movie[],ranges:CatalogueRanges):Movie[] {
  if (invalidCatalogueRanges(ranges)) return [];
  return movies.filter(movie => catalogueRangeFields.every(({key,type}) => {
    const {min,max} = ranges[key];
    if (!min && !max) return true;
    const value = key === 'release' ? movie.release_date : key === 'added' ? movie.createdAt && Number.isFinite(Date.parse(movie.createdAt)) ? amsterdamDate(movie.createdAt) : '' : key === 'year' ? movie.releaseYear : movie.duration;
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value) && value>0 && (!min || value>=Number(min)) && (!max || value<=Number(max));
    return typeof value === 'string' && value !== '' && Number.isFinite(Date.parse(value)) && (!min || value>=min) && (!max || value<=max);
  }));
}
