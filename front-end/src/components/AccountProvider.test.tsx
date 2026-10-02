import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import AccountProvider,{useAccount} from './AccountProvider';
import {api,ApiError} from '../services/accountService';
import {setPreference,snapshot} from '../lib/accountStorage';
jest.mock('../services/accountService',()=>({api:jest.fn(),passkey:jest.fn(),resetCsrf:jest.fn(),ApiError:jest.requireActual('../services/accountService').ApiError}));
const request=api as jest.Mock;
function Controls(){const a=useAccount()!;return <><span>{a.user?.name || 'Guest'}</span><span>{a.status}</span><span>{a.error}</span><button onClick={()=>setPreference('cinecompass_schedule_view','"posters"')}>Change view</button><button onClick={a.logout}>Sign out</button></>;}
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();});
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
