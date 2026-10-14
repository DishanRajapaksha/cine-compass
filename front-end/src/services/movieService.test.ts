import { movieService } from './movieService';
const event=(id:string) => ({id,productionId:'film',venueId:'eye',startDate:'2099-10-01T16:00:00Z',endDate:'2099-10-01T17:30:00Z',ticketingUrl:null,attributes:{subtitles:['en']},localizableAttributes:{},_embedded:{production:{id:'film',title:'A Film',slug:'a-film',assets:{},attributes:{duration:90,spokenLanguages:['en']},localizableAttributes:{}},venue:{id:'eye',slug:'eye',name:'Eye',address:{city:'Amsterdam'},assets:{},attributes:{},localizableAttributes:{},isHidden:false}}});
test('prefers a full English description over a Dutch short description and tracks the fallback language', async () => {
  const english = event('english');
  english.productionId = 'english-film';
  english._embedded.production.id = 'english-film';
  english._embedded.production.localizableAttributes = {'en-GB': {description: 'An English synopsis.', shortDescription: ' '}, 'nl-NL': {shortDescription: 'Een korte beschrijving.'}};
  const dutch = event('dutch');
  dutch._embedded.production.localizableAttributes = {'nl-NL': {shortDescription: 'Een Nederlandse film.'}};
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({count: 2, totalCount: 2, _links: {}, _embedded: {events: [english, dutch]}})});
  try {
    const film = await movieService.getMovieShowtimes('english-film', {selectedCity: null, selectedTheaters: ['eye'], selectedSubtitleLanguages: [], selectedSpokenLanguages: [], selectedSpecials: [], startDate: '2099-10-03', endDate: null, startTime: null, endTime: null});
    expect(film).toMatchObject({overview: 'An English synopsis.', overviewLanguage: 'en'});
    const fallback = await movieService.getMovieShowtimes('film', {selectedCity: null, selectedTheaters: ['eye'], selectedSubtitleLanguages: [], selectedSpokenLanguages: [], selectedSpecials: [], startDate: '2099-10-03', endDate: null, startTime: null, endTime: null});
    expect(fallback).toMatchObject({overview: 'Een Nederlandse film.', overviewLanguage: 'nl'});
  } finally { global.fetch = original; }
});
test('single-film search scopes by production and follows POST pagination without a default end-day bound',async () => {
  const fetchMock=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({count:1,totalCount:2,_links:{next:{href:'/events/search?page[after]=cursor'}},_embedded:{events:[event('one')]}})}).mockResolvedValueOnce({ok:true,json:async()=>({count:1,totalCount:2,_links:{},_embedded:{events:[event('two')]}})});
  const original=global.fetch;global.fetch=fetchMock;
  try {
    const result=await movieService.getMovieShowtimes('film',{selectedCity:'Amsterdam',selectedTheaters:['eye'],selectedSubtitleLanguages:[],selectedSpokenLanguages:[],selectedSpecials:[],startDate:'2099-10-01',endDate:null,startTime:null,endTime:null});
    expect(result?.showtimes.map(st=>st.id)).toEqual(['one','two']);
    const body=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.productionId).toEqual({eq:'film'});expect(body.startDate.lt).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.cineville.nl/events/search?page[after]=cursor');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(body);
  } finally {global.fetch=original;}
});

test('upcoming catalogue follows pagination, normalizes films without screenings, and removes duplicates and past releases',async () => {
  const upcoming={...event('one')._embedded.production,id:'upcoming',assets:{poster:{url:'https://example.com/poster.jpg'}},attributes:{premiereDate:'2099-10-22',duration:90,spokenLanguages:['en']},localizableAttributes:{'en-GB':{description:'An upcoming film.'}}};
  const earlier={...upcoming,id:'earlier',attributes:{...upcoming.attributes,premiereDate:'2099-10-15'}};
  const past={...upcoming,id:'past',attributes:{...upcoming.attributes,premiereDate:'2020-01-01'}};
  const unknown={...upcoming,id:'unknown',attributes:{duration:90,spokenLanguages:['en']}};
  const fetchMock=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({_links:{next:{href:'/productions/search?page[after]=cursor'}},_embedded:{productions:[upcoming,past,unknown]}})}).mockResolvedValueOnce({ok:true,json:async()=>({_links:{},_embedded:{productions:[upcoming,earlier]}})});
  const original=global.fetch;global.fetch=fetchMock;
  try {
    const result=await movieService.getUpcomingMovies();
    expect(result.map(movie=>movie.id)).toEqual(['earlier','upcoming']);
    expect(result[1]).toMatchObject({release_date:'2099-10-22',poster_path:'https://example.com/poster.jpg',overview:'An upcoming film.',overviewLanguage:'en',showtimes:[]});
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.cineville.nl/productions/search');
    const body=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({premiereDate:{isNull:false,gt:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)},sort:{premiereDate:'asc'}});
    expect(fetchMock.mock.calls[1][0]).toContain('page[after]=cursor');
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  } finally {global.fetch=original;}
});
