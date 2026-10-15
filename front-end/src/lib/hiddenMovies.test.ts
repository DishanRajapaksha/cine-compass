import { createHiddenMovieMatcher } from './hiddenMovies';
test('old IDs match the same film and re-release using title and original release year', () => {
  const hidden=createHiddenMovieMatcher([{id:'old-clouds',title:'Below the Clouds',year:2025},{id:'old-black-girl',title:'Black Girl',year:1966}]);
  expect(hidden({id:'678ad4ad-e244-470c-97e4-8405b2f4e548',title:'Below the Clouds',releaseYear:2025})).toBe(true);
  expect(hidden({id:'bbc8fbc4-a5c3-4a82-a4d9-e7c4a7a16818',title:'Black Girl (re-release)',releaseYear:1966})).toBe(true);
  expect(hidden({id:'different',title:'Black Girl',releaseYear:2025})).toBe(false);
  expect(hidden({id:'sequel',title:'Black Girl 2',releaseYear:1966})).toBe(false);
});
test('exact IDs remain sufficient while unknown years do not broadly hide same-name films', () => {
  const hidden=createHiddenMovieMatcher([{id:'exact',title:'A Film'},{id:'legacy',title:'Uncertain'}]);
  expect(hidden({id:'exact',title:'Renamed Film'})).toBe(true);
  expect(hidden({id:'another',title:'Uncertain',releaseYear:2020})).toBe(false);
});
test('identity matching tolerates casing, punctuation, and accents', () => {
  const hidden=createHiddenMovieMatcher([{id:'old',title:'  Un été! ',year:2020}]);
  expect(hidden({id:'new',title:'UN ETE',releaseYear:2020})).toBe(true);
});
