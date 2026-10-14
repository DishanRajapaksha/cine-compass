import { Movie } from '../types/Movie';
import { catalogueSortOptions, sortCatalogue } from './catalogueSort';
const films = [
  {id:'a',title:'Alpha',release_date:'2026-10-15',releaseYear:1990,duration:150,createdAt:'2024-01-01'},
  {id:'b',title:'Beta',release_date:'2025-01-01',releaseYear:2025,duration:90,createdAt:'2026-01-01'},
  {id:'c',title:'Unknown',release_date:'',releaseYear:0,duration:0,createdAt:'invalid'}
] as Movie[];
test.each([
  ['title-asc',['a','b','c']],['title-desc',['c','b','a']],
  ['release-asc',['b','a','c']],['release-desc',['a','b','c']],
  ['year-asc',['a','b','c']],['year-desc',['b','a','c']],
  ['duration-asc',['b','a','c']],['duration-desc',['a','b','c']],
  ['added-asc',['a','b','c']],['added-desc',['b','a','c']]
] as const)('%s sorts correctly with missing values last', (sort,expected) => {
  expect(sortCatalogue(films,sort).map(film=>film.id)).toEqual(expected);
  expect(films.map(film=>film.id)).toEqual(['a','b','c']);
});
test('every offered option is covered and ties use title order', () => {
  expect(catalogueSortOptions).toHaveLength(10);
  expect(sortCatalogue([{...films[0],title:'Film 10'},{...films[1],title:'Film 2',duration:150}],'duration-desc').map(film=>film.title)).toEqual(['Film 2','Film 10']);
});
