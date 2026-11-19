import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import useScreeningReminders from '../lib/useScreeningReminders';
import { screeningRemindersKey } from '../lib/screeningReminders';
import { api } from '../services/accountService';
import NotificationsPage from './NotificationsPage';
import ScreeningReminder, { ScreeningRemindersContext } from './ScreeningReminder';

jest.mock('../services/accountService', () => ({api: jest.fn()}));
const request = api as jest.Mock;

function Inbox({refreshCount}: {refreshCount: () => void}) {
  const reminders = useScreeningReminders(true);
  return <ScreeningRemindersContext.Provider value={reminders}>
    <ScreeningReminder id="film" title="A Film"/>
    <ScreeningReminder id="club" title="Film club" list/>
    <NotificationsPage reminders={reminders} unread={1} refreshCount={refreshCount}/>
  </ScreeningRemindersContext.Provider>;
}

test('saves the look-ahead and both reminder types, revisits older notices, and marks history read', async () => {
  localStorage.clear();
  const notice = {id:50,filmTitle:'A Film',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:null,startsAt:'2026-12-19T20:00:00Z',isRead:false};
  request.mockImplementation(async (path: string) => {
    if (path === '/notifications') return {items:[notice],unread:1,nextBefore:50};
    if (path === '/notifications?before=50') return {items:[{...notice,id:25,filmTitle:'Older Film',isRead:true}],unread:1,nextBefore:null};
  });
  render(<Inbox refreshCount={jest.fn()}/>);
  await screen.findByRole('heading',{name:'A Film New'});
  const windowInput = screen.getByRole('spinbutton',{name:'Look ahead (days)'});
  expect(windowInput).toHaveValue(365);
  fireEvent.change(windowInput,{target:{value:'366'}});
  expect(screen.getByRole('button',{name:'Save'})).toBeDisabled();
  fireEvent.change(windowInput,{target:{value:'45'}});
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  fireEvent.click(screen.getByRole('button',{name:'Notify me for A Film'}));
  fireEvent.click(screen.getByRole('button',{name:'Notify for list Film club'}));
  expect(JSON.parse(localStorage.getItem(screeningRemindersKey)!)).toEqual({lookAheadDays:45,filmIds:['film'],listIds:['club']});

  fireEvent.click(screen.getByRole('button',{name:'Load older notifications'}));
  await screen.findByRole('heading',{name:'Older Film'});
  fireEvent.click(screen.getByRole('button',{name:'Mark all read'}));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/notifications/read','POST',{through:50}));
  expect(await screen.findByRole('heading',{name:'A Film'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Older Film'})).toBeInTheDocument();
});
