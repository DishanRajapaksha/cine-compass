import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import { movieService } from './services/movieService';
import { getCurrentDateInAmsterdam, getCurrentTimeInAmsterdam } from './lib/utils';
import * as dateUtils from './lib/utils';
jest.mock('./services/movieService');
const service = movieService as jest.Mocked<typeof movieService>;
beforeEach(() => {
  jest.spyOn(dateUtils, 'getCurrentDateInAmsterdam').mockReturnValue('2026-10-01');
  jest.spyOn(dateUtils, 'getCurrentTimeInAmsterdam').mockReturnValue('14:00');
  window.location.hash=''; localStorage.clear();
  service.getTheaters.mockResolvedValue([{name:'Amsterdam',theaters:[{id:'eye',name:'Eye',city:'Amsterdam'}]}]);
  service.getMovieShowtimes.mockImplementation(async () => (await service.getPopularMovies()).results[0]);
  const today=getCurrentDateInAmsterdam();
  service.getPopularMovies.mockResolvedValue({page:1,total_pages:1,total_results:1,results:[{id:'film',title:'Perfect Days',poster_path:'https://example.com/poster.jpg',release_date:'',overview:'A day in Tokyo.',vote_average:0,genre_ids:[],duration:123,directors:[],cast:[],releaseYear:2023,spokenLanguages:['ja'],availableSubtitles:['en'],availableLanguageVersions:[],availableSpecials:[],showtimes:[{id:'screening',startDate:`${today}T21:58:00Z`,endDate:`${today}T23:59:00Z`,theaterId:'eye',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:null,specials:null,subtitles:'en',languageVersion:null}]}]});
});
afterEach(() => jest.restoreAllMocks());

test('hides all screenings across views and reloads, then restores from Settings',async () => {
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function() {this.setAttribute('open','');}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function() {this.removeAttribute('open');}});
  const response=await service.getPopularMovies();
  const film=response.results[0];
  service.getPopularMovies.mockResolvedValue({...response,results:[{...film,showtimes:[film.showtimes[0],{...film.showtimes[0],id:'alternative'}]}]});
  const view=render(<App/>);
  await screen.findAllByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getAllByRole('button',{name:/^Save Perfect Days/})[0]);
  fireEvent.click(screen.getAllByRole('button',{name:'Hide Perfect Days permanently'})[0]);
  expect(screen.queryByRole('button',{name:'Perfect Days'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Compact'}));
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));
  expect(screen.queryByRole('button',{name:'Perfect Days'})).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('cineville_saved_showtimes') || '[]')).toHaveLength(1);
  view.unmount();
  render(<App/>);
  await screen.findByText('No screenings in this window.');
  expect(screen.queryByRole('textbox',{name:'OMDb API key'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  const dialog=screen.getByRole('dialog',{name:'Settings'});
  expect(within(dialog).getByLabelText('OMDb API key')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:'Restore Perfect Days'}));
  expect(within(dialog).getByText('No hidden movies.')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:'Close settings'}));
  expect(screen.getAllByRole('button',{name:'Perfect Days'})).toHaveLength(2);
  expect(screen.getByRole('button',{name:'Watchlist 1'})).toBeInTheDocument();
});

test('switches to one compact layout with no posters and preserves saved screenings', async () => {
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  expect(screen.getByRole('img',{name:'Perfect Days'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Search IMDb for Perfect Days 2023'})).toHaveAttribute('href','https://www.imdb.com/find/?q=Perfect%20Days%202023&s=tt');
  fireEvent.click(screen.getByRole('button',{name:'Compact'}));
  expect(screen.getByRole('link',{name:'Search IMDb for Perfect Days 2023'})).toHaveAttribute('target','_blank');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('Language / subtitles')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/^Save Perfect Days/}));
  fireEvent.click(screen.getByRole('button',{name:'Watchlist 1'}));
  expect(screen.getByRole('heading',{name:'Perfect Days'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Search IMDb for Perfect Days'})).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('cineville_saved_showtimes') || '[]')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:/^Remove Perfect Days at/}));
  expect(screen.getByRole('button',{name:'Watchlist 0'})).toBeInTheDocument();
});

test('film details shows artwork, readable language, screening actions, and a missing-poster fallback',async () => {
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getByRole('button',{name:'Perfect Days'}));
  const dialog=screen.getByRole('dialog',{name:'Perfect Days'});
  expect(within(dialog).getByText('2023 · 123 min · Japanese')).toBeInTheDocument();
  const poster=within(dialog).getByRole('img',{name:'Perfect Days poster'});
  expect(poster).toHaveAttribute('src','https://example.com/poster.jpg');
  fireEvent.click(within(dialog).getByRole('button',{name:'Save screening'}));
  expect(within(dialog).getByRole('button',{name:'Remove saved screening'})).toHaveAttribute('aria-pressed','true');
  fireEvent.error(poster);
  expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button',{name:'Plan my evening'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('After Perfect Days')).toBeInTheDocument();
});
test('keeps filter choices available when a search has no matches',async () => {
  render(<App/>); await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.change(screen.getByRole('textbox',{name:'Search films'}),{target:{value:'no match'}});
  expect(screen.getByText('No screenings in this window.')).toBeInTheDocument();
  expect(screen.getByRole('option',{name:'Japanese'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));
  await waitFor(() => expect(screen.getByRole('button',{name:'Perfect Days'})).toBeInTheDocument());
});
test('defaults to the current Amsterdam time through the end of today',async () => {
  render(<App/>);
  expect(screen.getByLabelText('After')).toHaveValue(getCurrentTimeInAmsterdam());
  expect(screen.getByLabelText('Before')).toHaveValue('23:59');
  expect(screen.getByLabelText('From')).toHaveValue(getCurrentDateInAmsterdam());
  expect(screen.getByLabelText('To')).toHaveValue(getCurrentDateInAmsterdam());
  expect(screen.getByRole('combobox',{name:'Subtitles'})).toHaveValue('en');
  expect(screen.getByRole('combobox',{name:'Spoken language'})).toHaveValue('en');
  expect(screen.getByRole('button',{name:'Any (OR)'})).toHaveAttribute('aria-pressed','true');
  await screen.findByRole('button',{name:'Perfect Days'});
});

test('reopening on the same day refreshes the saved start time and keeps other preferences',async () => {
  const view = render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getByRole('button',{name:'All (AND)'}));
  fireEvent.input(screen.getByLabelText('After'),{target:{value:'15:00'}});
  fireEvent.input(screen.getByLabelText('Before'),{target:{value:'16:00'}});
  view.unmount();
  jest.mocked(dateUtils.getCurrentTimeInAmsterdam).mockReturnValue('17:30');
  render(<App/>);
  expect(screen.getByLabelText('After')).toHaveValue('17:30');
  expect(screen.getByLabelText('Before')).toHaveValue('23:59');
  expect(screen.getByRole('button',{name:'All (AND)'})).toHaveAttribute('aria-pressed','true');
  await screen.findByText('No screenings in this window.');
});

test('resuming a backgrounded PWA refreshes time only when it becomes visible',async () => {
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.input(screen.getByLabelText('After'),{target:{value:'15:00'}});
  jest.mocked(dateUtils.getCurrentTimeInAmsterdam).mockReturnValue('18:30');
  const visibility = jest.spyOn(document,'visibilityState','get');
  visibility.mockReturnValue('hidden');
  fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByLabelText('After')).toHaveValue('15:00');
  visibility.mockReturnValue('visible');
  fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByLabelText('After')).toHaveValue('18:30');
  expect(JSON.parse(localStorage.getItem('cinecompass_schedule_filters') || '{}').startTime).toBe('18:30');
});

test('restoring a cached page after midnight refreshes the date and time window',async () => {
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  jest.mocked(dateUtils.getCurrentDateInAmsterdam).mockReturnValue('2026-10-02');
  jest.mocked(dateUtils.getCurrentTimeInAmsterdam).mockReturnValue('00:15');
  fireEvent(window,new PageTransitionEvent('pageshow',{persisted:true}));
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-02');
  expect(screen.getByLabelText('To')).toHaveValue('2026-10-02');
  expect(screen.getByLabelText('After')).toHaveValue('00:15');
  expect(screen.getByLabelText('Before')).toHaveValue('23:59');
  await screen.findByText('No screenings in this window.');
});

test('resuming and reopening preserve an explicitly chosen future date and time',async () => {
  const view = render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getByRole('button',{name:'Tomorrow'}));
  fireEvent.input(screen.getByLabelText('After'),{target:{value:'10:00'}});
  jest.mocked(dateUtils.getCurrentTimeInAmsterdam).mockReturnValue('18:30');
  fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByLabelText('After')).toHaveValue('10:00');
  view.unmount();
  render(<App/>);
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-02');
  expect(screen.getByLabelText('After')).toHaveValue('10:00');
  await screen.findByText('No screenings in this window.');
});

test('OR shows English-subtitled and English-spoken films together, persists AND, and resets to OR',async () => {
  const response = await service.getPopularMovies();
  const base = response.results[0];
  service.getPopularMovies.mockResolvedValue({...response,results:[base,{...base,id:'spoken',title:'English Film',spokenLanguages:['en'],showtimes:[{...base.showtimes[0],id:'spoken-screening',subtitles:'nl'}]}]});
  const view = render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  expect(screen.getByRole('button',{name:'English Film'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'All (AND)'}));
  expect(screen.getByText('No screenings in this window.')).toBeInTheDocument();
  view.unmount();
  render(<App/>);
  await screen.findByText('No screenings in this window.');
  expect(screen.getByRole('button',{name:'All (AND)'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));
  expect(screen.getByRole('button',{name:'Any (OR)'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('button',{name:'Perfect Days'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'English Film'})).toBeInTheDocument();
});

test('existing schedule preferences receive the English OR default',async () => {
  localStorage.setItem('cinecompass_schedule_filters',JSON.stringify({selectedCity:'Amsterdam',selectedTheaters:['eye'],selectedSubtitleLanguages:['nl'],selectedSpokenLanguages:[],selectedSpecials:[],startDate:'2026-10-01',endDate:'2026-10-01',startTime:'14:00',endTime:'23:59'}));
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  expect(screen.getByRole('combobox',{name:'Subtitles'})).toHaveValue('en');
  expect(screen.getByRole('combobox',{name:'Spoken language'})).toHaveValue('en');
  expect(screen.getByRole('button',{name:'Any (OR)'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('button',{name:'Cinemas 1 selected'})).toBeInTheDocument();
});

test('native time input events filter the programme immediately',async () => {
  render(<App/>); await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.input(screen.getByLabelText('After'),{target:{value:'23:59'}});
  expect(screen.getByText('No screenings in this window.')).toBeInTheDocument();
  fireEvent.input(screen.getByLabelText('After'),{target:{value:'17:00'}});
  expect(screen.getByRole('button',{name:'Perfect Days'})).toBeInTheDocument();
});
test('cinema dropdown allows multiple selections and Escape closes it',async () => {
  service.getTheaters.mockResolvedValue([{name:'Amsterdam',theaters:[{id:'eye',name:'Eye',city:'Amsterdam'},{id:'lab',name:'LAB111',city:'Amsterdam'}]}]);
  render(<App/>); await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getByRole('button',{name:'Cinemas All cinemas'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Eye'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'LAB111'}));
  expect(screen.getByRole('button',{name:'Cinemas 2 selected'})).toHaveAttribute('aria-expanded','true');
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Search cinemas'}),{key:'Escape'});
  expect(screen.queryByRole('checkbox',{name:'Eye'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Cinemas 2 selected'})).toHaveFocus();
});
test.each(['Posters','Compact'])('row planning in %s hides unavailable films and repeats by default, and keeps the anchor',async view => {
  const base=(await service.getPopularMovies()).results[0];
  const st=base.showtimes[0];
  const anchor={...st,id:'anchor',startDate:'2026-10-01T16:00:00Z',endDate:'2026-10-01T18:00:00Z'};
  const repeat={...st,id:'repeat',startDate:'2026-10-01T20:00:00Z',endDate:'2026-10-01T22:00:00Z'};
  const blocked={...st,id:'blocked',startDate:'2026-10-01T17:00:00Z',endDate:'2026-10-01T19:00:00Z'};
  const next={...st,id:'next',startDate:'2026-10-01T18:30:00Z',endDate:'2026-10-01T20:00:00Z'};
  service.getPopularMovies.mockResolvedValue({page:1,total_pages:1,total_results:2,results:[{...base,showtimes:[anchor,repeat]},{...base,id:'next-film',title:'Next Film',showtimes:[blocked,next]}]});
  render(<App/>); await screen.findAllByRole('button',{name:'Next Film'});
  fireEvent.click(screen.getByRole('button',{name:view}));
  fireEvent.click(screen.getByRole('button',{name:'Plan my evening after Perfect Days at 18:00'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Plan my evening after Perfect Days at 18:00'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('button',{name:'Hide unavailable'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('checkbox',{name:'Hide other showtimes of this movie'})).toBeChecked();
  expect(screen.queryByRole('button',{name:/^19:00 /})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/^22:00 /})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'18:00 20:00 Your starting point'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'20:30 22:00'})).toBeInTheDocument();
});

test('preserves saved planner choices to highlight unavailable films and show repeats',async () => {
  localStorage.setItem('cinecompass_planner_prefs',JSON.stringify({availabilityMode:'highlight',hideSameMovie:false,bufferMinutes:25}));
  render(<App/>);
  await screen.findByRole('button',{name:'Perfect Days'});
  fireEvent.click(screen.getByRole('button',{name:/Plan my evening after Perfect Days/}));
  expect(screen.getByRole('button',{name:'Highlight available'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('checkbox',{name:'Hide other showtimes of this movie'})).not.toBeChecked();
  expect(screen.getByRole('spinbutton',{name:'Travel buffer minutes'})).toHaveValue(25);
});
