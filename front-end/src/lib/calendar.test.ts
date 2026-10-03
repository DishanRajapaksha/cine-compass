import { createCalendar, CalendarScreening } from './calendar';
const screening: CalendarScreening = {movieTitle:'Film, one; two\\three\nEncore',showtimeId:'one',startDate:'2026-10-24T23:30:00+02:00',endDate:'2026-10-25T02:30:00+01:00',theaterName:'Eye',theaterCity:'Amsterdam',ticketingUrl:'https://tickets.example/one'};
const now = new Date('2026-10-03T12:00:00Z');
test('exports exact instants across midnight and daylight saving with escaped metadata and tickets', () => {
  const ics = createCalendar([screening], null, now);
  expect(ics).toContain('DTSTART:20261024T213000Z\r\nDTEND:20261025T013000Z');
  expect(ics).toContain('SUMMARY:Film\\, one\\; two\\\\three\\nEncore');
  expect(ics).toContain('LOCATION:Eye\\, Amsterdam');
  expect(ics).toContain('URL:https://tickets.example/one');
  expect(ics).not.toContain('VALARM');
  expect(ics).toMatch(/END:VCALENDAR\r\n$/);
});
test('double bills contain independent events, ticket links and reminders', () => {
  const second = {...screening,movieTitle:'Second film',showtimeId:'two',ticketingUrl:'https://tickets.example/two'};
  const ics = createCalendar([screening,second], 30, now);
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  expect(ics).toContain('UID:one@cinecompass');
  expect(ics).toContain('UID:two@cinecompass');
  expect(ics.match(/TRIGGER:-PT30M/g)).toHaveLength(2);
  expect(ics).toContain('URL:https://tickets.example/two');
});
test('folds long unicode content without exceeding 75 bytes or losing characters', () => {
  const title = '🎬 é漢字'.repeat(40);
  const ics = createCalendar([{...screening,movieTitle:title}],null,now);
  for (const line of ics.split('\r\n')) expect(new Blob([line]).size).toBeLessThanOrEqual(75);
  expect(ics.replace(/\r\n /g,'')).toContain(`SUMMARY:${title}`);
});
test('handles missing tickets and rejects malformed date ranges and reminders', () => {
  const ics = createCalendar([{...screening,ticketingUrl:null}],null,now);
  expect(ics).toContain('Ticket link not available.');
  expect(ics).not.toContain('\r\nURL:');
  expect(() => createCalendar([{...screening,startDate:'bad'}],null,now)).toThrow();
  expect(() => createCalendar([{...screening,endDate:screening.startDate}],null,now)).toThrow();
  expect(() => createCalendar([screening],-1,now)).toThrow();
});
