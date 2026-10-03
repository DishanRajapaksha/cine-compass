import React from 'react';
import './CinemaAnimation.css';

function ProjectorScene() {
  return <svg viewBox="0 0 190 76" fill="none" focusable="false">
      <path className="cc-projector-beam" d="M67 38 133 19v36L67 44Z" fill="currentColor"/>
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 64h163" className="cc-cinema-ground"/>
        <path d="m28 54-5 10m24-10 5 10M24 64h27"/>
        <rect x="20" y="31" width="40" height="24" rx="6" className="cc-projector-body"/>
        <path d="m60 36 8-3v16l-8-3" className="cc-projector-body"/>
        <g transform="translate(26 21)">
          <g className="cc-projector-reel">
            <circle r="12" className="cc-projector-body"/>
            <circle r="2"/>
            <circle cy="-7" r="2"/><circle cx="7" r="2"/>
            <circle cy="7" r="2"/><circle cx="-7" r="2"/>
          </g>
        </g>
        <g transform="translate(51 21)">
          <g className="cc-projector-reel cc-projector-reel-back">
            <circle r="10" className="cc-projector-body"/>
            <circle r="1.5"/>
            <circle cy="-6" r="1.6"/><circle cx="6" r="1.6"/>
            <circle cy="6" r="1.6"/><circle cx="-6" r="1.6"/>
          </g>
        </g>
        <path d="M29 41h2m12 0h2m-12 6q4 4 8 0"/>
        <rect x="133" y="15" width="46" height="42" rx="3"/>
        <path d="M133 20h46m-23 37v7m-10 0h20"/>
        <path className="cc-cinema-curtain" d="M134 21h7v34h-7zm37 0h7v34h-7z"/>
        <path className="cc-cinema-star" d="m156 27 2.5 7.5L166 37l-7.5 2.5L156 47l-2.5-7.5L146 37l7.5-2.5Z"/>
      </g>
    </svg>;
}


function TheatreScene() {
  return <svg viewBox="0 0 190 76" fill="none" focusable="false">
    <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path className="cc-theatre-glow" d="M60 12h70l18 52H42Z" fill="currentColor" stroke="none"/>
      <rect x="60" y="9" width="70" height="35" rx="3" className="cc-projector-body"/>
      <path className="cc-cinema-star cc-theatre-star" d="m95 16 2.5 7.5L105 26l-7.5 2.5L95 36l-2.5-7.5L85 26l7.5-2.5Z"/>
      <path className="cc-theatre-curtains" d="M47 8h9v37q-4-4-9 0Zm87 0h9v37q-4-4-9 0Z"/>
      <path d="M45 8h100M51 12v25m87-25v25"/>
      <g className="cc-theatre-audience">
        <circle cx="83" cy="43" r="4" className="cc-projector-body"/>
        <circle cx="107" cy="43" r="4" className="cc-projector-body"/>
      </g>
      {[54,76,98,120].map(x => <g key={x}>
        <rect x={x} y="47" width="16" height="12" rx="4" className="cc-theatre-seat"/>
        <path d={`M${x-2} 53v7h20v-7`}/>
      </g>)}
      {[42,64,86,108,130].map(x => <g key={x}>
        <rect x={x} y="58" width="18" height="12" rx="4" className="cc-theatre-seat cc-theatre-seat-front"/>
        <path d={`M${x-2} 64v7h22v-7`}/>
      </g>)}
      <path className="cc-cinema-ground" d="M35 71h120"/>
    </g>
  </svg>;
}

type Scene = 'projector' | 'theatre';
let pageScene: Scene | undefined;

function sceneForPage(): Scene {
  // Choose once per page load, including React StrictMode and later re-renders.
  if (pageScene) return pageScene;
  pageScene = 'projector';
  try {
    if (localStorage.getItem('cinecompass_header_scene') === 'projector') pageScene = 'theatre';
    localStorage.setItem('cinecompass_header_scene', pageScene);
  } catch { /* The illustration still works when browser storage is unavailable. */ }
  return pageScene;
}

/** A decorative cinema vignette, alternating on each page load. */
export default function CinemaAnimation() {
  const scene = sceneForPage();
  return <span className="cc-cinema-animation" aria-hidden="true" data-scene={scene}>
    {scene === 'projector' ? <ProjectorScene/> : <TheatreScene/>}
  </span>;
}
