import { movieService } from './movieService';
import { MovieFilters } from '../types/Movie';

const filters: MovieFilters = {
  selectedCity: 'Den Haag', selectedTheaters: ['first', 'second'],
  selectedSpokenLanguages: ['fr'], selectedSubtitleLanguages: ['en'], selectedSpecials: ['Q&A'],
  startDate: '2026-11-18', endDate: '2026-11-19', startTime: '18:00', endTime: null
};

const fetchMock = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => [] });
});
afterEach(() => { global.fetch = originalFetch; });

test('sends date and screening filters to same-origin REST', async () => {
  await movieService.getPopularMovies(filters, true);
  const url = new URL(fetchMock.mock.calls[0][0], 'https://cinecompass.test');
  expect(url.origin + url.pathname).toBe('https://cinecompass.test/api/cineville/screenings');
  expect(url.searchParams.getAll('cinema')).toEqual(['first', 'second']);
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    city: 'Den Haag', language: 'fr', subtitle: 'en', special: 'Q&A',
    startDate: '2026-11-18', endDate: '2026-11-19', startTime: '18:00', includePosterless: 'true'
  });
  expect(url.searchParams.has('endTime')).toBe(false);
});

test('reads both catalogues and passes film IDs and city names safely', async () => {
  await movieService.getUpcomingMovies();
  await movieService.getNowShowingMovies('Den Haag');
  await movieService.getMovieShowtimes('film?alias');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/cineville/upcoming-films', '/api/cineville/now-showing?city=Den+Haag',
    '/api/cineville/films/film%3Falias/showtimes'
  ]);
});

test('surfaces REST failures so the page can retry', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 502 });
  await expect(movieService.getTheaters()).rejects.toThrow('502');
});
