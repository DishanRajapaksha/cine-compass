import { filterScreenings, screeningTime } from './schedule';
import { Movie, MovieFilters, MovieShowtime } from '../types/Movie';
const filters: MovieFilters = {selectedCity:'Amsterdam',selectedTheaters:[],selectedSubtitleLanguages:[],selectedSpokenLanguages:[],selectedSpecials:[],startDate:'2026-10-01',endDate:'2026-10-02',startTime:'18:00',endTime:'22:00'};
const showtime = (id: string, startDate: string, subtitles='en'): MovieShowtime => ({id,startDate,endDate:startDate,theaterId:'eye',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:null,specials:null,subtitles,languageVersion:null});
const movie: Movie = {id:'film',title:'Perfect Days',poster_path:'',release_date:'',overview:'',vote_average:0,genre_ids:[],duration:123,directors:[],cast:[],releaseYear:2023,spokenLanguages:['ja'],availableSubtitles:['en','nl'],availableLanguageVersions:[],availableSpecials:[],showtimes:[showtime('late','2026-10-02T18:00:00Z'),showtime('morning','2026-10-02T08:00:00Z'),showtime('dutch','2026-10-01T17:00:00Z','nl'),showtime('english','2026-10-01T16:00:00Z')]};
test('applies Amsterdam daily time windows on every date and sorts all screenings',() => {
  expect(filterScreenings([movie],filters,'').map(s => s.showtime.id)).toEqual(['english','dutch','late']);
});
test('filters subtitles per screening rather than film availability',() => {
  expect(filterScreenings([movie],{...filters,selectedSubtitleLanguages:['en']},'perfect').map(s => s.showtime.id)).toEqual(['english','late']);
});
test('combines cinema, language, and title filters without dropping posterless films',() => {
  expect(filterScreenings([movie],{...filters,selectedTheaters:['eye'],selectedSpokenLanguages:['ja']},'days')).toHaveLength(3);
  expect(filterScreenings([movie],{...filters,selectedTheaters:['other']},'')).toHaveLength(0);
  expect(filterScreenings([movie],filters,'unknown')).toHaveLength(0);
});
test('formats both sides of daylight saving in Amsterdam independently of host zone',() => {
  expect(screeningTime('2026-10-24T18:00:00Z')).toBe('20:00');
  expect(screeningTime('2026-10-26T18:00:00Z')).toBe('19:00');
});

test('OR includes either language match, AND requires both, and other filters still apply',() => {
  const englishSpoken = {...movie,id:'spoken',title:'English Film',spokenLanguages:['en-GB'],showtimes:[showtime('spoken-only','2026-10-01T17:00:00Z','nl'),showtime('both','2026-10-01T18:00:00Z','en'),showtime('outside-time','2026-10-01T08:00:00Z','nl'),{...showtime('outside-city','2026-10-01T18:00:00Z','nl'),theaterCity:'Rotterdam'}]};
  const selected: MovieFilters = {...filters,selectedSubtitleLanguages:['en'],selectedSpokenLanguages:['en'],languageMatchMode:'any'};
  expect(filterScreenings([movie,englishSpoken],selected,'').map(s => s.showtime.id)).toEqual(['english','spoken-only','both','late']);
  expect(filterScreenings([movie,englishSpoken],{...selected,languageMatchMode:'all'},'').map(s => s.showtime.id)).toEqual(['both']);
  for (const languageMatchMode of ['any','all'] as const) {
    expect(filterScreenings([movie],{...selected,languageMatchMode,selectedSpokenLanguages:[]},'').map(s => s.showtime.id)).toEqual(['english','late']);
    expect(filterScreenings([movie],{...selected,languageMatchMode,selectedSubtitleLanguages:[],selectedSpokenLanguages:[]},'')).toHaveLength(3);
  }
});
