import React, { useId, useState } from 'react';
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
  const pattern = (id: string) => <defs>
      <pattern id={id} width="252" height="56" patternUnits="userSpaceOnUse">
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
    </defs>;
  return <><svg className="cc-filmstrip-desktop" fill="none" focusable="false">
    {pattern(patternId)}
    <g className="cc-filmstrip-track">
      <rect x="-252" width="calc(100% + 504px)" height="56" fill={`url(#${patternId})`}/>
    </g>
  </svg><svg className="cc-filmstrip-mobile" viewBox="0 0 252 56" fill="none" focusable="false">
    {pattern(`${patternId}-mobile`)}
    <g className="cc-filmstrip-track">
      <rect x="-252" width="756" height="56" fill={`url(#${patternId}-mobile)`}/>
    </g>
  </svg></>;
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

function AutumnScene() {
  return <svg className="cc-autumn-scene" viewBox="0 0 360 76" fill="none" focusable="false" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path className="cc-cinema-ground" d="M20 69h320"/>
      <path d="M64 68V29m0 22L46 37m18 5 17-15"/>
      <path className="cc-autumn-canopy" d="M42 43c-16-2-19-20-7-27-1-13 17-19 26-10 11-9 28-1 27 11 15 7 10 25-3 27"/>
      <rect x="224" y="20" width="77" height="40" rx="3" className="cc-projector-body"/>
      <path d="m232 60-3 9m64-9 3 9"/>
      <path className="cc-autumn-screen-leaf" d="M250 48c-3-13 4-21 20-20 1 13-5 23-20 20Z"/>
      <path d="m247 51 18-18m-10 10 9 1m-5-5-1-7"/>
      <path className="cc-autumn-beam" d="m139 43 84-16v27l-84-5Z" fill="currentColor" stroke="none"/>
      <rect x="115" y="37" width="22" height="16" rx="3" className="cc-projector-body"/>
      <path d="m137 41 5-2v12l-5-2m-15 4-4 16m13-16 4 16"/>
      <g transform="translate(119 30)"><g className="cc-projector-reel"><circle r="6" className="cc-projector-body"/><circle r="1.5"/><path d="M0-4v1m4 3H3M0 4V3m-4-3h1"/></g></g>
      <g transform="translate(133 30)"><g className="cc-projector-reel cc-projector-reel-back"><circle r="6" className="cc-projector-body"/><circle r="1.5"/><path d="M0-4v1m4 3H3M0 4V3m-4-3h1"/></g></g>
      <path className="cc-autumn-bench" d="M166 56h35v6h-35Zm3 6v7m29-7v7m-32-18h35v8h-35Z"/>
      {[{x:99,y:13},{x:166,y:8},{x:204,y:19}].map(({x,y},i) => <g key={x} transform={`translate(${x} ${y})`}>
        <g className={`cc-autumn-leaf cc-autumn-leaf-${i}`}>
          <path d="M-5 0c0-5 5-7 11-6 1 6-2 11-7 11Z"/>
          <path d="m-3 7 6-10"/>
        </g>
      </g>)}
      <path className="cc-autumn-ground-leaves" d="m37 66 7-2 4 3-8 1Zm43 1 5-3 6 2-7 2Zm226-1 7-2 4 3-8 1Z"/>
    </g>
  </svg>;
}

function PremiereScene() {
  const screenId = useId();
  return <svg className="cc-premiere-scene" viewBox="0 0 360 76" fill="none" focusable="false" aria-hidden="true">
    <defs><clipPath id={screenId}><rect x="143" y="32" width="74" height="23" rx="2"/></clipPath></defs>
    <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path className="cc-premiere-cloud" d="M53 11h28c6 0 6-7 1-7-2-6-11-6-14-1-5-3-11 1-10 5h-5"/>
      <path className="cc-premiere-moon" d="M290 13a7 7 0 1 1-8-10 6 6 0 0 0 8 10Z"/>
      <path className="cc-premiere-sparkles" d="M108 8v4m-2-2h4m148-6v4m-2-2h4m63 3v4m-2-2h4"/>
      <g className="cc-premiere-houses">
        <path d="M24 60V28l12-12 12 12v32m-20-32h16M54 60V23h4v-5h4v-5h8v5h4v5h4v37m7 0V31l12-9 12 9v29"/>
        {[31,40,61,70,92,101].map((x,i) => <g key={x}>
          <path className="cc-premiere-window" style={{animationDelay:`${i * .15}s`}} d={`M${x} 34h4v6h-4Zm0 11h4v6h-4Z`}/>
        </g>)}
        <path d="M33 60V50h7v10m21 0v-6h10v6m22 0v-6h7v6"/>
      </g>
      <path className="cc-premiere-light" d="m130 59-22-42 44 12Zm100 0 22-42-44 12Z" stroke="none"/>
      <path className="cc-projector-body" d="M122 61V25l8-9h100l8 9v36Z" stroke="none"/>
      <rect x="127" y="13" width="106" height="13" rx="3" className="cc-premiere-marquee" stroke="none"/>
      <text x="180" y="22" textAnchor="middle" stroke="none" fill="currentColor" fontSize="7" fontFamily="Georgia, serif" letterSpacing="2">CINEMA</text>
      {[133,145,157,169,181,193,205,217,229].map((x,i) => <g key={x} className="cc-premiere-bulb" style={{animationDelay:`${i * .12}s`}}>
        <circle cx={x} cy="14" r="1"/><circle cx={x} cy="25" r="1"/>
      </g>)}
      <g clipPath={`url(#${screenId})`}>
        <rect x="143" y="32" width="74" height="23" className="cc-premiere-screen" stroke="none"/>
        <g className="cc-premiere-feature">
          <path d="m180 34 2.7 6.8 7.3 2.7-7.3 2.7L180 53l-2.7-6.8-7.3-2.7 7.3-2.7Z"/>
          <path d="M158 41v4m-2-2h4m42-5v4m-2-2h4"/>
        </g>
        <g className="cc-premiere-curtain cc-premiere-curtain-left"><path d="M143 32h37v23h-37Z"/><path d="M150 32v23m8-23v23m8-23v23m8-23v23"/></g>
        <g className="cc-premiere-curtain cc-premiere-curtain-right"><path d="M180 32h37v23h-37Z"/><path d="M186 32v23m8-23v23m8-23v23m8-23v23"/></g>
      </g>
      <path className="cc-premiere-carpet" d="m171 57-8 8h34l-8-8Z"/>
      <g className="cc-premiere-guest">
        <circle cx="250" cy="43" r="3" className="cc-projector-body"/>
        <path d="M247 48h6l2 9h-10Zm2 9-1 7m4-7 1 7m-7-14-4 3"/>
      </g>
      <g>
        <path className="cc-premiere-kiosk" d="M271 42h23v20h-23Zm-3 0 4-6h21l4 6Z"/>
        <path d="M277 45h11v9h-11Zm-1 13h13m-10-8h6"/>
        <circle cx="283" cy="49" r="2"/>
      </g>
      <path d="M321 64V27m-6 0h12m-10-10h8l2 10h-12Zm4-4h2"/>
      <path className="cc-premiere-lantern" d="M318 19h6v6h-6Z"/>
      <g className="cc-premiere-cat"><path d="M305 62v-7l3 2 3-2v7q0 3-3 3h-5c-4 0-4-5-1-5"/><path d="M307 60h.1m2 0h.1"/></g>
      <path className="cc-cinema-ground" d="M18 65h324"/>
      <path className="cc-premiere-water" d="M20 70h17m55 0h20m28 0h29m42 0h29m35 0h18m25 0h23M26 74h31m70 0h24m31 0h33m58 0h29"/>
      <g className="cc-premiere-boat">
        <path className="cc-projector-body" d="m43 64 4 7h35l7-7Z"/>
        <path d="M54 64v-6h21v6m-17-6v6m10-6v6"/>
        <path className="cc-premiere-wake" d="M29 70h10m-15 3h17"/>
      </g>
    </g>
  </svg>;
}

const scenes = ['projector', 'theatre', 'filmstrip', 'moonlit', 'autumn', 'premiere'] as const;
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

/** A cinema vignette, cycling on activation and alternating on page load. */
export default function CinemaAnimation() {
  const [scene, setScene] = useState(sceneForPage);
  const nextScene = () => {
    const next = scenes[(scenes.indexOf(scene) + 1) % scenes.length];
    pageScene = next;
    try { localStorage.setItem('cinecompass_header_scene', next); } catch { /* Cycling still works without storage. */ }
    setScene(next);
  };
  return <button type="button" className={`cc-cinema-animation${scene === 'filmstrip' || scene === 'moonlit' || scene === 'autumn' || scene === 'premiere' ? ' cc-cinema-animation-wide' : ''}`} aria-label="Show next cinema animation" title="Show next cinema animation" data-scene={scene} onClick={nextScene}>
    <React.Fragment key={scene}>
      {scene === 'projector' ? <ProjectorScene/> : scene === 'theatre' ? <TheatreScene/> : scene === 'filmstrip' ? <FilmstripScene/> : scene === 'moonlit' ? <MoonlitScene/> : scene === 'autumn' ? <AutumnScene/> : <PremiereScene/>}
    </React.Fragment>
  </button>;
}
