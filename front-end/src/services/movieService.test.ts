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
