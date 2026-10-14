import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HeaderNavigation from './HeaderNavigation';

test.each([['Now showing','now-showing'],['Coming soon','upcoming'],['Settings',null]])('touch blur does not dismiss %s before its click', (label,page) => {
  const onPage=jest.fn(), onSettings=jest.fn();
  render(<HeaderNavigation page="schedule" count={0} onPage={onPage} onSettings={onSettings}/>);
  fireEvent.click(screen.getByRole('button',{name:'More pages'}));
  const first=screen.getByRole('menuitem',{name:'Now showing'});
  // Touch browsers can blur the focused item without focusing the tapped button.
  fireEvent.blur(first,{relatedTarget:null});
  fireEvent.click(screen.getByRole('menuitem',{name:label}));
  if (page) expect(onPage).toHaveBeenCalledWith(page); else expect(onSettings).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('menu dismisses on outside pointer interaction and keyboard focus leaving', () => {
  render(<><HeaderNavigation page="schedule" count={0} onPage={jest.fn()} onSettings={jest.fn()}/><button>Outside</button></>);
  const trigger=screen.getByRole('button',{name:'More pages'});
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole('button',{name:'Outside'}));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.blur(screen.getByRole('menuitem',{name:'Now showing'}),{relatedTarget:screen.getByRole('button',{name:'Outside'})});
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
