import React from 'react';
import { Sparkle } from 'lucide-react';
import CinemaAnimation from './CinemaAnimation';
import './OpeningScreen.css';

export default function OpeningScreen() {
  return <main className="cc-app cc-opening">
    <div className="cc-opening-content">
      <div className="cc-opening-brand"><Sparkle size={25} fill="currentColor" strokeWidth={1} aria-hidden="true"/><span>Cine Compass<span className="cc-brand-dot">.</span></span></div>
      <CinemaAnimation/>
      <p role="status">Opening CineCompass…</p>
    </div>
  </main>;
}
