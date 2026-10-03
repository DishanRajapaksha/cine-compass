import React, { useId } from 'react';
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

function FilmstripScene() {
  const patternId = useId();
  return <svg fill="none" focusable="false">
    <defs>
      <pattern id={patternId} width="252" height="56" patternUnits="userSpaceOnUse">
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 5h252M0 51h252" className="cc-filmstrip-rail"/>
          {[0,84,168].map(x => <g key={x} transform={`translate(${x} 0)`}>
            <rect x="7" y="14" width="70" height="28" rx="3" className="cc-filmstrip-frame"/>
            {[7,21,35,49,63,77].map(hole => <g key={hole} className="cc-filmstrip-perforation">
              <rect x={hole} y="7.5" width="4" height="3" rx=".7"/>
              <rect x={hole} y="45.5" width="4" height="3" rx=".7"/>
            </g>)}
          </g>)}
          <path className="cc-filmstrip-motif" d="m42 19 2.2 6.8L51 28l-6.8 2.2L42 37l-2.2-6.8L33 28l6.8-2.2Z"/>
          <g className="cc-filmstrip-motif">
            <path d="m119 26 2 11h11l2-11Z"/>
            <path d="M119 26c-5-3-1-8 3-6 0-6 8-6 8 0 5-3 9 3 4 6Z"/>
            <path d="m124 29 .5 5m4.5-5-.5 5"/>
          </g>
          <path className="cc-filmstrip-motif" d="M210 36s-13-7-10-13c2-4 7-4 10 0 3-4 8-4 10 0 3 6-10 13-10 13Z"/>
        </g>
      </pattern>
    </defs>
    <g className="cc-filmstrip-track">
      <rect x="-252" width="calc(100% + 504px)" height="56" fill={`url(#${patternId})`}/>
    </g>
  </svg>;
}

function MoonlitScene() {
  return <svg className="cc-moonlit-scene" viewBox="0 0 360 76" fill="none" focusable="false">
    <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path className="cc-cinema-ground" d="M20 69h320"/>
      <path className="cc-moonlit-string" d="M25 12q155 31 310 0"/>
      {[48,78,108,138,168,198,228,258,288,318].map((x,i) => <circle key={x} cx={x} cy={16 + Math.sin((i+1)*Math.PI/11)*12} r="1.7" className="cc-moonlit-lights"/>)}
      <path className="cc-moonlit-moon" d="M327 30a9 9 0 1 1-10-13 8 8 0 0 0 10 13Z"/>
      <path className="cc-moonlit-beam" d="m113 43 138-12v25L113 49Z" fill="currentColor" stroke="none"/>
      <rect x="32" y="32" width="79" height="30" rx="11" className="cc-projector-body"/>
      <path d="M34 53h75m2-14 7 2v11l-7 2M26 61h7"/>
      <circle cx="48" cy="63" r="6" className="cc-projector-body"/><circle cx="94" cy="63" r="6" className="cc-projector-body"/>
      <circle cx="48" cy="63" r="1.6"/><circle cx="94" cy="63" r="1.6"/>
      <rect x="43" y="38" width="26" height="15" rx="3" className="cc-moonlit-window"/>
      <path d="M56 38v15m-10-12v9m20-9v9"/>
      <rect x="80" y="39" width="17" height="23" rx="3"/>
      <path d="M92 51h1m-22 11v6m-5 1h10"/>
      <path className="cc-moonlit-awning" d="m135 38-6 8h35l-6-8Z"/>
      <path d="M133 46v21m27-21v21m-27-11h27m-23 11h19"/>
      <path className="cc-moonlit-popcorn" d="m141 50 1 6h8l1-6c3-3 0-5-2-3-1-4-6-4-6 0-3-2-5 0-2 3Z"/>
      <rect x="251" y="29" width="64" height="30" rx="3" className="cc-projector-body"/>
      <path d="m258 59-3 10m53-10 3 10"/>
      <path className="cc-cinema-star cc-moonlit-screen-star" d="m283 35 2.2 6.8L292 44l-6.8 2.2L283 53l-2.2-6.8L274 44l6.8-2.2Z"/>
      <g className="cc-theatre-audience">
        <circle cx="207" cy="53" r="4" className="cc-projector-body"/>
        <circle cx="229" cy="53" r="4" className="cc-projector-body"/>
      </g>
      {[199,221].map(x => <g key={x}>
        <rect x={x} y="57" width="16" height="11" rx="3" className="cc-projector-body"/>
        <path d={`M${x-2} 62v7h20v-7`}/>
      </g>)}
      <path className="cc-moonlit-sparkles" d="M124 24v4m-2-2h4m107 9v4m-2-2h4M21 34v4m-2-2h4"/>
      <g className="cc-moonlit-shooting-star">
        <path d="m158 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor" fillOpacity=".16"/>
        <path d="m149 9-13-6m10 10-8-2" strokeOpacity=".35"/>
      </g>
    </g>
  </svg>;
}

const scenes = ['projector', 'theatre', 'filmstrip', 'moonlit'] as const;
type Scene = typeof scenes[number];
let pageScene: Scene | undefined;

function sceneForPage(): Scene {
  // Choose once per page load, including React StrictMode and later re-renders.
  if (pageScene) return pageScene;
  pageScene = 'projector';
  try {
    const previous = localStorage.getItem('cinecompass_header_scene');
    const index = scenes.findIndex(scene => scene === previous);
    pageScene = scenes[(index + 1) % scenes.length];
    localStorage.setItem('cinecompass_header_scene', pageScene);
  } catch { /* The illustration still works when browser storage is unavailable. */ }
  return pageScene;
}

/** A decorative cinema vignette, alternating on each page load. */
export default function CinemaAnimation() {
  const scene = sceneForPage();
  return <span className={`cc-cinema-animation${scene === 'filmstrip' || scene === 'moonlit' ? ' cc-cinema-animation-wide' : ''}`} aria-hidden="true" data-scene={scene}>
    {scene === 'projector' ? <ProjectorScene/> : scene === 'theatre' ? <TheatreScene/> : scene === 'filmstrip' ? <FilmstripScene/> : <MoonlitScene/>}
  </span>;
}
