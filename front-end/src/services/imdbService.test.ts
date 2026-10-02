import { resolveImdb } from './imdbService';
const originalFetch = global.fetch;
const response = (film: unknown) => ({ok:true,json:async () => film});
beforeEach(() => {localStorage.clear();});
afterEach(() => {global.fetch=originalFetch;});

test('shares duplicate requests, cleans rerelease titles, and caches matches without the key',async () => {
  const fetchMock = jest.fn().mockResolvedValue(response({Response:'True',Year:'1988',imdbID:'tt0094625',imdbRating:'8.0'}));
  global.fetch=fetchMock;
  const results=await Promise.all([resolveImdb('Akira (re-release)',1988,'test-key'),resolveImdb('Akira (re-release)',1988,'test-key')]);
  expect(results).toEqual([{id:'tt0094625',rating:'8.0'},{id:'tt0094625',rating:'8.0'}]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('t')).toBe('Akira');
  await resolveImdb('Akira (re-release)',1988,'test-key');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('cinecompass_imdb_cache')).not.toContain('test-key');
});
test('retries same-named films by year and rejects a mismatched remake',async () => {
  const fetchMock=jest.fn().mockResolvedValue(response({Response:'True',Year:'2002',imdbID:'tt0123456',imdbRating:'6.0'}));
  global.fetch=fetchMock;
  expect(await resolveImdb('A remake',2026,'test-key')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('y')).toBe('2026');
});
test('missing films are cached but key errors can be retried with a corrected key',async () => {
  const fetchMock=jest.fn().mockResolvedValueOnce(response({Response:'False',Error:'Invalid API key!'})).mockResolvedValueOnce(response({Response:'False',Error:'Movie not found!'}));
  global.fetch=fetchMock;
  expect(await resolveImdb('Missing',2026,'bad-key')).toBeNull();
  expect(await resolveImdb('Missing',2026,'good-key')).toBeNull();
  expect(await resolveImdb('Missing',2026,'good-key')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
test('no key or network failure leaves the search fallback available',async () => {
  const fetchMock=jest.fn().mockRejectedValue(new Error('offline'));
  global.fetch=fetchMock;
  expect(await resolveImdb('Film',2026,'')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await resolveImdb('Film',2026,'test-key')).toBeNull();
});
