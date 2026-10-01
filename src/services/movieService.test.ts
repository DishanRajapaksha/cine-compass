import { movieService } from './movieService';
const event=(id:string) => ({id,productionId:'film',venueId:'eye',startDate:'2099-10-01T16:00:00Z',endDate:'2099-10-01T17:30:00Z',ticketingUrl:null,attributes:{subtitles:['en']},localizableAttributes:{},_embedded:{production:{id:'film',title:'A Film',slug:'a-film',assets:{},attributes:{duration:90,spokenLanguages:['en']},localizableAttributes:{}},venue:{id:'eye',slug:'eye',name:'Eye',address:{city:'Amsterdam'},assets:{},attributes:{},localizableAttributes:{},isHidden:false}}});
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
