import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { languageName, screeningTime } from '../lib/schedule';

export type Notice = {
  id: number;
  filmId: string;
  filmTitle: string;
  theaterName: string;
  theaterCity: string;
  ticketingUrl: string | null;
  startsAt: string;
  isRead: boolean;
  audioLanguages?: string[] | null;
  audioSource?: string | null;
  languageVersion?: string | null;
  subtitleLanguages?: string[] | null;
  subtitleStatus?: string | null;
};

type DatedNotice = {notice: Notice; start: number};

const screeningDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

function ticketLink(url: string | null) {
  if (!url) return undefined;
  try { return ['https:', 'http:'].includes(new URL(url).protocol) ? url : undefined; }
  catch { return undefined; }
}

function ScreeningNotice({notice, upcoming}: {notice: Notice; upcoming: boolean}) {
  const tickets = upcoming && ticketLink(notice.ticketingUrl);
  const date = screeningDate.format(new Date(notice.startsAt));
  const audio = notice.audioLanguages?.map(languageName).join(', ');
  const subtitles = notice.subtitleLanguages?.map(languageName).join(', ');
  return <li className="cc-notification-screening">
    <div>
      <div className="cc-notification-time">
        <time dateTime={notice.startsAt}>{date} · {screeningTime(notice.startsAt)}</time>
        {!notice.isRead && <span className="cc-notification-new">New</span>}
      </div>
      <div className="cc-notification-venue">
        <strong>{notice.theaterName}</strong>{notice.theaterCity && <span>{notice.theaterCity}</span>}
      </div>
      <div className="cc-notification-languages">
        <span>Audio · {audio || notice.languageVersion || 'Unlisted'}{audio && notice.audioSource === 'film' && ' (film listing)'}</span>
        <span>Subtitles · {subtitles || (notice.subtitleStatus === 'none' ? 'None' : 'Unlisted')}</span>
      </div>
    </div>
    {tickets && <a className="cc-text-button" href={tickets} target="_blank" rel="noopener noreferrer"
      aria-label={`Tickets for ${notice.filmTitle} at ${notice.theaterName} on ${date} at ${screeningTime(notice.startsAt)}`}>Tickets ↗</a>}
  </li>;
}

function NotificationFilm({group, now}: {group: DatedNotice[]; now: number}) {
  const [expanded, setExpanded] = useState(true);
  const showtimesId = useId();
  return <li className="cc-notification-film">
    <h4>
      <button type="button" aria-expanded={expanded} aria-controls={showtimesId} onClick={() => setExpanded(value => !value)}>
        {group[0].notice.filmTitle}
        <ChevronDown size={17} aria-hidden="true"/>
      </button>
    </h4>
    <ul id={showtimesId} hidden={!expanded}>
      {group.map(({notice, start}) => <ScreeningNotice key={notice.id} notice={notice} upcoming={start > now}/>)}
    </ul>
  </li>;
}

export default function NotificationScreenings({items}: {items: Notice[]}) {
  const now = Date.now();
  const screenings = items.map(notice => ({notice, start: Date.parse(notice.startsAt)}))
    .sort((a, b) => Number(a.start <= now) - Number(b.start <= now) || a.start - b.start || a.notice.id - b.notice.id);
  const films = new Map<string, DatedNotice[]>();
  for (const screening of screenings) {
    const filmId = screening.notice.filmId;
    const group = films.get(filmId);
    if (group) group.push(screening);
    else films.set(filmId, [screening]);
  }

  return <ul className="cc-notification-history">
    {Array.from(films, ([filmId, group]) => <NotificationFilm key={filmId} group={group} now={now}/>)}
  </ul>;
}
