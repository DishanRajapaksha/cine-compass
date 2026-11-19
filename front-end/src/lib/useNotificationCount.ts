import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/accountService';

export default function useNotificationCount(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback((signal?: AbortSignal) => {
    if (!enabled) return;
    void api<{unread: number}>('/notifications/unread').then(result => {
      if (!signal?.aborted) setUnread(result.unread);
    }).catch(() => { /* The inbox shows request errors when opened. */ });
  }, [enabled]);
  useEffect(() => {
    const controller = new AbortController();
    const check = () => { if (!document.hidden) refresh(controller.signal); };
    check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [refresh]);
  return {unread: enabled ? unread : 0, refresh};
}
