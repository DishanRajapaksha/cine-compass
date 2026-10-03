import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarButton from './CalendarButton';
import * as calendar from '../lib/calendar';
const screenings = [
  {movieTitle:'First film',showtimeId:'one',startDate:'2026-10-04T16:00:00Z',endDate:'2026-10-04T18:00:00Z',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:'https://example.com/first'},
  {movieTitle:'Second film',showtimeId:'two',startDate:'2026-10-04T18:30:00Z',endDate:'2026-10-04T20:30:00Z',theaterName:'Kriterion',theaterCity:'Amsterdam',ticketingUrl:'https://example.com/second'}
];
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function() {this.setAttribute('open','');}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function() {this.removeAttribute('open');}});
});
afterEach(() => jest.restoreAllMocks());
test('previews two films and exports the chosen reminder without claiming they were saved', () => {
  const download = jest.spyOn(calendar,'downloadCalendar').mockImplementation(() => {});
  const file = jest.spyOn(calendar,'calendarFile');
  render(<CalendarButton screenings={screenings} label="Add double bill"/>);
  fireEvent.click(screen.getByRole('button',{name:'Add double bill: First film + Second film'}));
  expect(screen.getByRole('dialog',{name:'Add double bill to calendar'})).toBeInTheDocument();
  expect(screen.getByText('Eye · Amsterdam')).toBeInTheDocument();
  expect(screen.getByText('Kriterion · Amsterdam')).toBeInTheDocument();
  expect(screen.getAllByRole('link',{name:/Tickets for/})).toHaveLength(2);
  expect(screen.getByLabelText('Reminder for each film')).toHaveValue('none');
  fireEvent.change(screen.getByLabelText('Reminder for each film'),{target:{value:'30'}});
  fireEvent.click(screen.getByRole('button',{name:'Download calendar file'}));
  expect(file).toHaveBeenCalledWith(screenings,30);
  expect(download).toHaveBeenCalledWith(expect.objectContaining({name:'cinecompass-double-bill.ics'}));
  expect(screen.getByRole('status')).toHaveTextContent('Open it in your calendar app');
  fireEvent.click(screen.getByRole('button',{name:'Close calendar export'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
