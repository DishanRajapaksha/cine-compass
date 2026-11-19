import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/accountService';
import NotificationScreenings, { Notice } from './NotificationScreenings';

type Page = {items: Notice[]; unread: number; nextBefore: number | null};

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
    {page && (page.items.length ? <NotificationScreenings items={page.items}/> :
      <div className="cc-empty"><Bell size={28} aria-hidden="true"/><h4>No screening notifications yet</h4><p>Follow a film or a list to get started.</p></div>)}
    {page?.nextBefore && <button className="cc-text-button" disabled={busy} onClick={() => void load(page.nextBefore!)}>Load older notifications</button>}
  </section>;
}
