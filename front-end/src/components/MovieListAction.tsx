import React, { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ListPlus } from 'lucide-react';
import { MovieList, SavedFilm } from '../types/Movie';
import { isBuiltInList } from '../lib/movieLists';
import './MovieListAction.css';

export const MovieListsContext = createContext<{
  lists: MovieList[];
  toggleFilm: (id: string, film: SavedFilm) => void;
} | null>(null);

function positionPicker(button: HTMLButtonElement, picker: HTMLDivElement) {
  const anchor = button.getBoundingClientRect();
  const dialog = button.closest('dialog')?.getBoundingClientRect();
  const gap = 8;
  const left = Math.max(0, dialog?.left ?? 0) + gap;
  const right = Math.min(document.documentElement.clientWidth, dialog?.right ?? Infinity) - gap;
  const top = Math.max(0, dialog?.top ?? 0) + gap;
  const bottom = Math.min(window.innerHeight, dialog?.bottom ?? Infinity) - gap;
  const width = Math.min(252, Math.max(0, right - left));
  const below = Math.max(0, bottom - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - top - gap);
  const opensAbove = below < Math.min(picker.scrollHeight, 260) && above > below;
  picker.style.width = `${width}px`;
  picker.style.left = `${Math.max(left, Math.min(anchor.right - width, right - width))}px`;
  picker.style.maxHeight = `${Math.min(260, opensAbove ? above : below)}px`;
  picker.style.top = opensAbove ? 'auto' : `${Math.max(top, anchor.bottom + gap)}px`;
  picker.style.bottom = opensAbove ? `${window.innerHeight - anchor.top + gap}px` : 'auto';
}

export default function MovieListAction({film}: {film: SavedFilm}) {
  const context = useContext(MovieListsContext);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lists = context?.lists.filter(list => !isBuiltInList(list.id));

  useLayoutEffect(() => {
    const button = trigger.current;
    const picker = panel.current;
    if (!open || !button || !picker) return;
    const update = () => positionPicker(button, picker);
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    update();
    (picker.querySelector<HTMLInputElement>('input:checked') ?? picker.querySelector('input'))?.focus({preventScroll: true});
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, lists?.length]);

  if (!context || !lists?.length) return null;

  const options = lists.map(list => ({list, selected: list.films.some(entry => entry.id === film.id)}));
  return <div ref={root} className="cc-movie-list-action" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (!open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  }}>
    <button type="button" ref={trigger} className="cc-movie-list-trigger" aria-label={`Add to list: ${film.title}`}
      aria-expanded={open} aria-controls={open ? id : undefined} data-selected={options.some(option => option.selected)}
      onClick={() => setOpen(value => !value)}>
      <ListPlus size={15} aria-hidden="true"/> Add to list <ChevronDown className="cc-list-picker-arrow" size={13} aria-hidden="true"/>
    </button>
    {open && <div ref={panel} id={id} className="cc-list-picker" role="group" aria-label="Movie lists">
      {options.map(({list, selected}) => <label key={list.id}>
        <input type="checkbox" checked={selected} onChange={() => context.toggleFilm(list.id, film)}/>
        <span>{list.name}</span>
      </label>)}
    </div>}
  </div>;
}
