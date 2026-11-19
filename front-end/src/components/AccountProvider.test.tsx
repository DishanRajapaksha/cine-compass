import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import AccountProvider,{useAccount} from './AccountProvider';
import {api,ApiError} from '../services/accountService';
import {cinemaListsKey,setPreference,snapshot} from '../lib/accountStorage';
import { movieListsKey } from '../lib/movieLists';
import CinemaLists from './CinemaLists';
import ImdbSettings from './ImdbSettings';
jest.mock('../services/accountService',()=>({api:jest.fn(),resetCsrf:jest.fn(),ApiError:jest.requireActual('../services/accountService').ApiError}));
const request=api as jest.Mock;
function Controls(){const a=useAccount()!;return <><span>{a.user?.name || 'Guest'}</span><span>{a.status}</span><span>{a.error}</span><button onClick={()=>setPreference('cinecompass_schedule_view','"posters"')}>Change view</button><button onClick={a.logout}>Sign out</button></>;}
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();});
test('saving selected cinemas syncs a new list alongside existing account lists', async () => {
  const existing = {name:'Utrecht',theaterIds:['springhaver']};
  request.mockImplementation(async (path, method) => {
    if (path === '/auth/me') return {user:{id:'alice',name:'Alice'}};
    if (path === '/settings' && method !== 'PUT')
      return {userId:'alice',revision:7,values:{[cinemaListsKey]:JSON.stringify([existing])}};
    if (path === '/settings') return {revision:8};
  });
  render(<AccountProvider><CinemaLists selected={['eye','rialto']} loading={false} onApply={jest.fn()}/></AccountProvider>);
  await screen.findByRole('option',{name:'Utrecht'});
  fireEvent.click(screen.getByRole('button',{name:'Save selected cinemas'}));
  fireEvent.change(screen.getByRole('textbox',{name:'List name'}),{target:{value:'Weekend'}});
  fireEvent.click(screen.getByRole('button',{name:'Save list'}));
  expect(screen.getByRole('combobox',{name:'Cinema lists'})).toHaveValue('Weekend');
  await waitFor(() => expect(request).toHaveBeenCalledWith('/settings','PUT',{
    userId:'alice',revision:7,values:{
      [cinemaListsKey]:JSON.stringify([existing,{name:'Weekend',theaterIds:['eye','rialto']}])
    }
  }));
});

test('syncs with the account revision and restores guest preferences on sign-out',async()=>{
  localStorage.setItem('cinecompass_schedule_view','"guest-view"');
  request.mockImplementation(async(path,method)=>{
    if(path==='/auth/me')return {user:{id:'alice',name:'Alice'}};
    if(path==='/settings' && method!=='PUT')return {userId:'alice',revision:7,values:{cinecompass_schedule_view:'"compact"'}};
    if(path==='/settings')return {revision:8};
  });
  render(<AccountProvider><Controls/></AccountProvider>);
  await screen.findByText('Alice');expect(localStorage.getItem('cinecompass_schedule_view')).toBe('"compact"');fireEvent.click(screen.getByText('Change view'));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/settings','PUT',{userId:'alice',revision:7,values:{cinecompass_schedule_view:'"posters"'}}));
  await screen.findByText('Saved');fireEvent.click(screen.getByText('Sign out'));await screen.findByText('Guest');
  expect(localStorage.getItem('cinecompass_schedule_view')).toBe('"guest-view"');expect(localStorage.getItem('cinecompass_active_account')).toBeNull();
});
test('conflicts retain local changes and stop overwrites',async()=>{
  request.mockImplementation(async(path,method)=>{
    if(path==='/auth/me')return {user:{id:'alice',name:'Alice'}};
    if(path==='/settings' && method!=='PUT')return {userId:'alice',revision:7,values:{cinecompass_schedule_view:'"compact"'}};
    if(path==='/settings')throw new ApiError('Reload account settings',409);
  });
  render(<AccountProvider><Controls/></AccountProvider>);await screen.findByText('Alice');fireEvent.click(screen.getByText('Change view'));
  await screen.findByText('Not synced');expect(localStorage.getItem('cinecompass_schedule_view')).toBe('"posters"');expect(screen.getByText('Reload account settings')).toBeInTheDocument();
});
test('snapshots exclude credentials and temporary dates and times',()=>{
  localStorage.setItem('cinecompass_omdb_key','private-key');localStorage.setItem('cinecompass_imdb_cache','cache');
  localStorage.setItem('cinecompass_schedule_filters',JSON.stringify({selectedCity:'Amsterdam',startDate:'2026-10-02',endDate:'2026-10-02',startTime:'12:00',endTime:'23:59'}));
  const values=snapshot();expect(Object.keys(values)).toEqual(['cinecompass_schedule_filters']);expect(JSON.parse(values.cinecompass_schedule_filters)).toEqual({selectedCity:'Amsterdam',startDate:null,endDate:null,startTime:null,endTime:null});
});

test('copies a device key to the account and removes the account key separately', async () => {
  localStorage.setItem('cinecompass_omdb_key','device-key');
  request.mockImplementation(async path => {
    if (path === '/auth/me') return {user:{id:'alice',name:'Alice'}};
    if (path === '/settings') return {userId:'alice',revision:2,values:{},omdbConfigured:false};
  });
  render(<AccountProvider><ImdbSettings/></AccountProvider>);
  const copy = await screen.findByRole('button',{name:'Save device key to account'});
  expect(screen.getByLabelText('OMDb API key')).toHaveValue('');
  fireEvent.click(copy);
  expect(request).toHaveBeenCalledWith('/imdb/key','PUT',{userId:'alice',key:'device-key'});
  fireEvent.click(await screen.findByRole('button',{name:'Remove key'}));
  expect(request).toHaveBeenLastCalledWith('/imdb/key','PUT',{userId:'alice',key:null});
  expect(await screen.findByText('OMDb key removed.')).toBeInTheDocument();
  expect(localStorage.getItem('cinecompass_omdb_key')).toBe('device-key');
  expect(snapshot()).toEqual({});
});

test('film watchlists sync to their owner and guest films return on sign-out',async()=>{
  const guestFilms=JSON.stringify([{id:'guest-film',title:'Guest Film',posterPath:''}]);
  const accountFilms=JSON.stringify([{id:'account-film',title:'Account Film',posterPath:''}]);
  const accountLists=JSON.stringify([
    {id:'watchlist',name:'Watchlist',films:JSON.parse(accountFilms)},
    {id:'watched',name:'Watched',films:[]},
    {id:'custom',name:'Rewatch',films:JSON.parse(accountFilms),hideWatched:true}
  ]);
  localStorage.setItem('cinecompass_saved_films',guestFilms);
  request.mockImplementation(async(path,method)=>{
    if(path==='/auth/me')return {user:{id:'alice',name:'Alice'}};
    if(path==='/settings' && method!=='PUT')return {userId:'alice',revision:7,values:{[movieListsKey]:accountLists}};
    if(path==='/settings')return {revision:8};
  });
  render(<AccountProvider><Controls/></AccountProvider>);
  await screen.findByText('Alice');
  expect(localStorage.getItem(movieListsKey)).toBe(accountLists);
  fireEvent.click(screen.getByText('Change view'));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/settings','PUT',{userId:'alice',revision:7,values:{[movieListsKey]:accountLists,cinecompass_schedule_view:'"posters"'}}));
  await screen.findByText('Saved');
  fireEvent.click(screen.getByText('Sign out'));
  await screen.findByText('Guest');
  expect(JSON.parse(localStorage.getItem(movieListsKey)!)[0].films).toEqual(JSON.parse(guestFilms));
});

test('migrates legacy watched films for the account and its separate guest backup', async () => {
  const guestFilms = JSON.stringify([{id:'guest-film',title:'Guest Film'}]);
  const accountFilms = JSON.stringify([{id:'account-film',title:'Account Film'}]);
  const migrated = (films: string) => JSON.stringify([
    {id:'watchlist',name:'Watchlist',films:[]},
    {id:'watched',name:'Watched',films:JSON.parse(films).map((film: object) => ({...film,posterPath:''}))}
  ]);
  localStorage.setItem('cinecompass_active_account','alice');
  localStorage.setItem('cinecompass_guest_settings',JSON.stringify({cinecompass_hidden_movies:guestFilms}));
  request.mockImplementation(async (path, method) => {
    if (path === '/auth/me') return {user:{id:'alice',name:'Alice'}};
    if (path === '/settings' && method !== 'PUT')
      return {userId:'alice',revision:7,values:{cinecompass_hidden_movies:accountFilms}};
    if (path === '/settings') return {revision:8};
  });
  render(<AccountProvider><Controls/></AccountProvider>);
  await screen.findByText('Alice');
  expect(localStorage.getItem('cinecompass_hidden_movies')).toBeNull();
  expect(localStorage.getItem(movieListsKey)).toBe(migrated(accountFilms));
  expect(JSON.parse(localStorage.getItem('cinecompass_guest_settings')!)).toEqual({[movieListsKey]:migrated(guestFilms)});
  fireEvent.click(screen.getByText('Change view'));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/settings','PUT',{
    userId:'alice',revision:7,values:{[movieListsKey]:migrated(accountFilms),cinecompass_schedule_view:'"posters"'}
  }));
  await screen.findByText('Saved');
  fireEvent.click(screen.getByText('Sign out'));
  await screen.findByText('Guest');
  expect(localStorage.getItem(movieListsKey)).toBe(migrated(guestFilms));
});
