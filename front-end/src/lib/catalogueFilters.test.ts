import { Movie } from '../types/Movie';
import { emptyCatalogueRanges, filterCatalogue, invalidCatalogueRanges, catalogueRangeValues } from './catalogueFilters';
const movies = [
  {id:'a',release_date:'2026-10-15',releaseYear:1990,duration:150,createdAt:'2026-10-14T23:00:00Z'},
  {id:'b',release_date:'2025-01-01',releaseYear:2025,duration:90,createdAt:'2024-01-01T12:00:00Z'},
  {id:'unknown',release_date:'',releaseYear:0,duration:0}
] as Movie[];
test('unset ranges include unknown metadata', () => expect(filterCatalogue(movies,emptyCatalogueRanges())).toHaveLength(3));
test.each([
  ['release','2026-10-15','2026-10-15',['a']],
  ['year','2020','2030',['b']],
  ['duration','','90',['b']],
  ['duration','150','',['a']],
  ['added','2026-10-15','2026-10-15',['a']]
] as const)('%s range includes endpoints and excludes missing values', (key,min,max,ids) => {
  const ranges=emptyCatalogueRanges();ranges[key]={min,max};
  expect(filterCatalogue(movies,ranges).map(movie=>movie.id)).toEqual(ids);
});
test('ranges combine and inverted ranges are invalid', () => {
  const ranges=emptyCatalogueRanges();ranges.year={min:'2020',max:''};ranges.duration={min:'100',max:''};
  expect(filterCatalogue(movies,ranges)).toEqual([]);
  ranges.duration={min:'150',max:'90'};
  expect(invalidCatalogueRanges(ranges)).toBe(true);
});

test('available filter values use all catalogue data, deduplicate, sort, and omit missing metadata', () => {
  expect(catalogueRangeValues([...movies,movies[0]])).toEqual({release:['2025-01-01','2026-10-15'],year:['1990','2025'],duration:['90','150'],added:['2024-01-01','2026-10-15']});
});
