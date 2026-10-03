import { SavedShowtime } from '../types/Movie';
import { Screening } from './schedule';

export type CalendarScreening = Pick<SavedShowtime, 'movieTitle' | 'showtimeId' | 'startDate' | 'endDate' | 'theaterName' | 'theaterCity' | 'ticketingUrl'>;
export const calendarScreening = ({ movie, showtime }: Screening): CalendarScreening => ({ ...showtime, showtimeId: showtime.id, movieTitle: movie.title });
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const timestamp = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('This screening has an invalid date.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};
// RFC 5545 limits content lines to 75 UTF-8 octets, including continuation spaces.
const foldLine = (line: string) => {
  const parts: string[] = [];
  let part = '', bytes = 0;
  for (const char of line) {
    const size = new Blob([char]).size;
    if (bytes + size > 75) { parts.push(part); part = ' '; bytes = 1; }
    part += char; bytes += size;
  }
  parts.push(part);
  return parts.join('\r\n');
};
export function createCalendar(screenings: CalendarScreening[], reminder: number | null, now = new Date()): string {
  if (!screenings.length) throw new Error('Choose a screening first.');
  if (reminder !== null && (!Number.isInteger(reminder) || reminder < 0)) throw new Error('Choose a valid reminder.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cine Compass//Screenings//EN', 'CALSCALE:GREGORIAN'];
  screenings.forEach(s => {
    const start = timestamp(s.startDate), end = timestamp(s.endDate);
    if (Date.parse(s.endDate) <= Date.parse(s.startDate)) throw new Error('The screening end time must come after its start.');
    const tickets = s.ticketingUrl && /^https?:\/\/[^\s]+$/i.test(s.ticketingUrl) ? s.ticketingUrl : null;
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(s.showtimeId)}@cinecompass`, `DTSTAMP:${timestamp(now.toISOString())}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeText(s.movieTitle)}`, `LOCATION:${escapeText([s.theaterName, s.theaterCity].filter(Boolean).join(', '))}`, `DESCRIPTION:${escapeText(`Cinema screening: ${s.movieTitle}\n${s.theaterName}, ${s.theaterCity}${tickets ? `\nTickets: ${tickets}` : '\nTicket link not available.'}`)}`);
    if (tickets) lines.push(`URL:${tickets}`);
    if (reminder !== null) lines.push('BEGIN:VALARM', `TRIGGER:-PT${reminder}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(s.movieTitle)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function calendarFile(screenings: CalendarScreening[], reminder: number | null): File {
  return new File([createCalendar(screenings, reminder)], screenings.length > 1 ? 'cinecompass-double-bill.ics' : 'cinecompass-screening.ics', { type: 'text/calendar;charset=utf-8' });
}
export function downloadCalendar(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
