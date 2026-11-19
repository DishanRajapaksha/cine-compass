import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { screeningTime } from '../lib/schedule';
import { api } from '../services/accountService';

type Notice = {
  id: number;
  filmTitle: string;
  theaterName: string;
  theaterCity: string;
  ticketingUrl: string | null;
  startsAt: string;
  isRead: boolean;
};
type Page = {items: Notice[]; unread: number; nextBefore: number | null};

const screeningDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

function ticketLink(url: string | null) {
  if (!url) return undefined;
  try { return ['https:', 'http:'].includes(new URL(url).protocol) ? url : undefined; }
  catch { return undefined; }
}

export default function NotificationHistory({unread, refreshCount}: {unread: number; refreshCount: () => void}) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (before?: number, signal?: AbortSignal) => {
    setBusy(true);
    setError('');
    try {
      const next = await api<Page>(before ? `/notifications?before=${before}` : '/notifications');
      if (signal?.aborted) return;
      setPage(current => before && current ? {...next, items: [...current.items, ...next.items]} : next);
      refreshCount();
    } catch (error) {
      if (!signal?.aborted) setError((error as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [refreshCount]);
  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);

  const markRead = async () => {
    const through = page?.items[0]?.id;
    if (!through) return;
    setBusy(true);
    setError('');
    try {
      await api('/notifications/read', 'POST', {through});
      setPage(current => current && {...current, unread: 0, items: current.items.map(item => ({...item, isRead: true}))});
      refreshCount();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };

  return <section aria-labelledby="cc-notification-history">
    <header className="cc-notification-history-heading">
      <h3 id="cc-notification-history">Screening history</h3>
      <div>
        <button className="cc-text-button" disabled={busy} onClick={() => void load()}>Refresh</button>
        <button className="cc-text-button" disabled={busy || !page?.items.length || !(page.unread || unread)} onClick={markRead}>Mark all read</button>
      </div>
    </header>
    {error && <p className="cc-error" role="alert">{error}</p>}
    {!page && busy && <p role="status">Loading notifications…</p>}
    {page && (page.items.length ? <ul className="cc-notification-history">
      {page.items.map(notice => {
        const tickets = ticketLink(notice.ticketingUrl);
        return <li key={notice.id}>
          <div>
            <h4>{notice.filmTitle} {!notice.isRead && <span className="cc-notification-new">New</span>}</h4>
            <p><time dateTime={notice.startsAt}>{screeningDate.format(new Date(notice.startsAt))} · {screeningTime(notice.startsAt)}</time></p>
            <p>{notice.theaterName}{notice.theaterCity && `, ${notice.theaterCity}`}</p>
          </div>
          {tickets && Date.parse(notice.startsAt) > Date.now() && <a className="cc-text-button" href={tickets} target="_blank" rel="noopener noreferrer" aria-label={`Tickets for ${notice.filmTitle}`}>Tickets ↗</a>}
        </li>;
      })}
    </ul> : <div className="cc-empty"><Bell size={28} aria-hidden="true"/><h4>No screening notifications yet</h4><p>Follow a film or a list to get started.</p></div>)}
    {page?.nextBefore && <button className="cc-text-button" disabled={busy} onClick={() => void load(page.nextBefore!)}>Load older notifications</button>}
  </section>;
}
