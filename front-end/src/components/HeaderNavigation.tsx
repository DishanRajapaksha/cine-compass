import React, { useEffect, useId, useRef, useState } from 'react';
import { Menu } from 'lucide-react';

type Page = 'schedule'|'watchlist'|'upcoming'|'now-showing';
type Props = {page:Page;count:number;onPage:(page:Page)=>void;onSettings:()=>void};
export default function HeaderNavigation({page,count,onPage,onSettings}:Props) {
  const [open,setOpen] = useState(false);
  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => {setOpen(false);trigger.current?.focus();};
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event:PointerEvent) => {if (!container.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return () => document.removeEventListener('pointerdown',outside);
  },[open]);
  const choose = (value:Page) => {onPage(value);close();};
  function menuKeyDown(event:React.KeyboardEvent) {
    if (event.key === 'Escape') {event.preventDefault();close();return;}
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (index+(event.key === 'ArrowDown' ? 1 : -1)+items.length)%items.length;
    items[next]?.focus();
  }
  return <nav aria-label="Main navigation">
    <button className={page === 'schedule' ? 'active' : ''} onClick={() => {setOpen(false);onPage('schedule');}}>Schedule</button>
    <button className={page === 'watchlist' ? 'active' : ''} onClick={() => {setOpen(false);onPage('watchlist');}}>Watchlist <span className="cc-count">{count}</span></button>
    <div className="cc-header-menu" ref={container} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);}}>
      <button ref={trigger} className={`cc-menu-trigger${page === 'upcoming' || page === 'now-showing' ? ' active' : ''}`} aria-label="More pages" title="More pages" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)} onKeyDown={event => {if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();setOpen(true);}}}><Menu size={21}/></button>
      {open && <div id={menuId} ref={menu} className="cc-header-menu-panel" role="menu" aria-label="More pages" onKeyDown={menuKeyDown}>
        <button role="menuitem" aria-current={page === 'now-showing' ? 'page' : undefined} onClick={() => choose('now-showing')}>Now showing</button>
        <button role="menuitem" aria-current={page === 'upcoming' ? 'page' : undefined} onClick={() => choose('upcoming')}>Coming soon</button>
        <button role="menuitem" aria-haspopup="dialog" onClick={() => {close();onSettings();}}>Settings</button>
      </div>}
    </div>
  </nav>;
}
