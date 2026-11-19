import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import useScreeningReminders from '../lib/useScreeningReminders';
import { screeningRemindersKey } from '../lib/screeningReminders';
import { api } from '../services/accountService';
import NotificationsPage from './NotificationsPage';
import ScreeningReminder, { ScreeningRemindersContext } from './ScreeningReminder';
import SettingsModal from './SettingsModal';

jest.mock('../services/accountService', () => ({api: jest.fn()}));
const request = api as jest.Mock;

function Inbox({refreshCount}: {refreshCount: () => void}) {
  const reminders = useScreeningReminders(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const options = {reminders, cities:[{name:'Amsterdam',theaters:[]},{name:'Rotterdam',theaters:[]}],
    languages:['en','fr','nl'], cityError:'', retryCities:jest.fn()};
  return <ScreeningRemindersContext.Provider value={options}>
    <ScreeningReminder id="film" title="A Film"/>
    <ScreeningReminder id="club" title="Film club" list/>
    <NotificationsPage enabled={reminders.enabled} unread={1} refreshCount={refreshCount}/>
    <button onClick={() => setSettingsOpen(true)}>Open settings</button>
    {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)}
      screeningReminders={options}/>}
  </ScreeningRemindersContext.Provider>;
}

test('saves look-ahead preferences in Settings and keeps screening history in Notifications', async () => {
  localStorage.clear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable:true, value:function() { this.setAttribute('open', ''); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable:true, value:function() { this.removeAttribute('open'); },
  });
  const notice = {id:50,filmId:'film',filmTitle:'A Film',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:null,
    startsAt:'2099-12-22T20:00:00Z',isRead:false,audioLanguages:['fr'],subtitleLanguages:['en'],subtitleStatus:'listed'};
  const earlier = {...notice,id:40,startsAt:'2099-11-28T20:00:00Z',subtitleLanguages:[],subtitleStatus:'none'};
  request.mockImplementation(async (path: string) => {
    if (path === '/notifications') return {items:[notice,earlier],unread:1,nextBefore:50};
    if (path === '/notifications?before=50') return {items:[
      {...earlier,id:25,startsAt:'2099-12-01T20:00:00Z',isRead:true,subtitleStatus:'unlisted'},
      {...earlier,id:24,filmId:'older',filmTitle:'Older Film',startsAt:'2099-11-20T20:00:00Z',isRead:true},
    ],unread:1,nextBefore:null};
  });
  render(<Inbox refreshCount={jest.fn()}/>);
  expect(screen.queryByRole('heading',{name:'Screening history'})).not.toBeInTheDocument();
  const film = (await screen.findByRole('heading',{name:'A Film'})).closest('li')!;
  expect(within(film).getAllByRole('listitem').map(item => item.querySelector('time')?.dateTime))
    .toEqual([earlier.startsAt, notice.startsAt]);
  expect(within(film).getAllByText('Eye')).toHaveLength(2);
  expect(within(film).getAllByText('Amsterdam')).toHaveLength(2);
  expect(within(film).getAllByText('Audio · French')).toHaveLength(2);
  expect(within(film).getByText('Subtitles · English')).toBeInTheDocument();
  expect(within(film).getByText('Subtitles · None')).toBeInTheDocument();
  const toggleFilm = within(film).getByRole('button',{name:'A Film'});
  expect(toggleFilm).toHaveAttribute('aria-expanded','true');
  fireEvent.click(toggleFilm);
  expect(toggleFilm).toHaveAttribute('aria-expanded','false');
  expect(within(film).queryByRole('list')).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton',{name:'Look ahead (days)'})).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox',{name:'City'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Open settings'}));
  const dialog = within(screen.getByRole('dialog',{name:'Settings'}));
  const settings = within(dialog.getByRole('region',{name:'Screening notifications'}));
  const windowInput = settings.getByRole('spinbutton',{name:'Look ahead (days)'});
  const cityInput = settings.getByRole('combobox',{name:'City'});
  expect(windowInput).toHaveValue(365);
  expect(cityInput).toHaveValue('');
  expect(settings.getByRole('button',{name:'Any (OR)'})).toHaveAttribute('aria-pressed','true');
  expect(settings.getByRole('combobox',{name:'Spoken language'})).toHaveValue('en');
  expect(settings.getByRole('combobox',{name:'Subtitles'})).toHaveValue('en');
  fireEvent.change(windowInput,{target:{value:'366'}});
  expect(settings.getByRole('button',{name:'Save'})).toBeDisabled();
  fireEvent.change(windowInput,{target:{value:'45'}});
  fireEvent.change(cityInput,{target:{value:'Amsterdam'}});
  fireEvent.click(settings.getByRole('button',{name:'All (AND)'}));
  fireEvent.click(settings.getByRole('button',{name:'Save'}));
  fireEvent.click(dialog.getByRole('button',{name:'Close settings'}));
  fireEvent.click(screen.getByRole('button',{name:'Notify me for A Film'}));
  fireEvent.click(screen.getByRole('button',{name:'Notify for list Film club'}));
  const saved = () => JSON.parse(localStorage.getItem(screeningRemindersKey)!);
  const globalFilters = {lookAheadDays:45,city:'Amsterdam',languageMatchMode:'all',
    selectedSpokenLanguages:['en'],selectedSubtitleLanguages:['en']};
  expect(saved()).toEqual({...globalFilters,filmIds:['film'],listIds:['club']});

  const openFilters = (title: string) => {
    fireEvent.click(screen.getByRole('button',{name:`Reminder filters for ${title}`}));
    return within(screen.getByRole('dialog',{name:'Reminder filters'}));
  };
  const filmFilters = openFilters('A Film');
  fireEvent.click(filmFilters.getByRole('button',{name:'Any (OR)'}));
  fireEvent.change(filmFilters.getByRole('combobox',{name:'City'}),{target:{value:'Rotterdam'}});
  fireEvent.change(filmFilters.getByRole('combobox',{name:'Spoken language'}),{target:{value:'fr'}});
  fireEvent.click(filmFilters.getByRole('button',{name:'Save'}));
  expect(saved()).toMatchObject({...globalFilters, filmFilters:{film:{...globalFilters,
    city:'Rotterdam',languageMatchMode:'any',selectedSpokenLanguages:['fr']}}});

  const listFilters = openFilters('Film club');
  expect(listFilters.getByRole('combobox',{name:'City'})).toHaveValue('Amsterdam');
  fireEvent.change(listFilters.getByRole('combobox',{name:'Subtitles'}),{target:{value:''}});
  fireEvent.click(listFilters.getByRole('button',{name:'Save'}));
  expect(saved().listFilters.club.selectedSubtitleLanguages).toEqual([]);
  fireEvent.click(openFilters('A Film').getByRole('button',{name:'Use global filters'}));
  expect(saved().filmFilters).toEqual({});

  fireEvent.click(screen.getByRole('button',{name:'Load older notifications'}));
  await screen.findByRole('heading',{name:'Older Film'});
  expect(screen.getAllByRole('heading',{level:3}).map(heading => heading.textContent)).toEqual(['Older Film','A Film']);
  expect(screen.getByRole('button',{name:'Older Film'})).toHaveAttribute('aria-expanded','true');
  expect(within(film).queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(toggleFilm);
  expect(toggleFilm).toHaveAttribute('aria-expanded','true');
  expect(within(film).getByText('Subtitles · Unlisted')).toBeInTheDocument();
  expect(within(film).getAllByRole('listitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Mark all read'}));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/notifications/read','POST',{through:50}));
  await waitFor(() => expect(screen.queryByText('New')).not.toBeInTheDocument());
  expect(screen.getByRole('heading',{name:'Older Film'})).toBeInTheDocument();
});
