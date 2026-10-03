import React, { useEffect, useId, useRef, useState } from 'react';
import './StarryNightScene.css';

const skyColors = ['#568bb5', '#8babb8', '#2c648f', '#c2c6a1', '#3e779f'];
const stars = [
  { x: 99, y: 24, r: 5.2 }, { x: 150, y: 18, r: 4.1 },
  { x: 187, y: 31, r: 3.3 }, { x: 283, y: 19, r: 4.8 },
  { x: 328, y: 42, r: 4 }, { x: 374, y: 18, r: 3.4 },
  { x: 416, y: 56, r: 3.5 },
];

// Fixed brush geometry keeps the painting stable through re-renders. All motion
// runs in CSS; there is no animation loop or per-frame React state update.
function spiralStroke(cx: number, cy: number, rx: number, ry: number, phase: number) {
  return Array.from({ length: 64 }, (_, i) => {
    const progress = i / 63;
    const angle = phase + progress * Math.PI * 3.2;
    const radius = .12 + progress * .88;
    return `${i ? 'L' : 'M'}${(cx + Math.cos(angle) * rx * radius).toFixed(2)} ${(cy + Math.sin(angle) * ry * radius).toFixed(2)}`;
  }).join(' ');
}

function BrushSwirl({ x, y, rx, ry, reverse = false }: {
  x: number; y: number; rx: number; ry: number; reverse?: boolean;
}) {
  return <g transform={`translate(${x} ${y})`}>
    <g className={`cc-starry-swirl${reverse ? ' cc-starry-swirl-reverse' : ''}`}>
      {Array.from({ length: 18 }, (_, i) => <path key={i}
        d={spiralStroke(0, 0, rx - i * .45, ry - i * .18, i * .35)}
        stroke={skyColors[i % skyColors.length]} strokeWidth={i % 3 === 0 ? 1.8 : .85}
        opacity={i % 3 === 0 ? .75 : .45}
        strokeDasharray={`${3 + i % 4} ${1.4 + i % 3}`} />)}
    </g>
  </g>;
}

/** A borderless, brush-painted night sky with a short, layered choreography. */
function StarryNightScene() {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(460);
  const spread = canvasWidth / 460;
  const edgeId = `${id}-edge`;
  const maskId = `${id}-mask`;
  const skyId = `${id}-sky`;
  const moonId = `${id}-moon`;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height > 0) setCanvasWidth(Math.max(460, Math.round(width / height * 112)));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const houses = Array.from({ length: Math.round(12 * spread) }, (_, i) => {
    const x = 114 * spread + i * 23;
    return { x, y: 88 + i % 3 * 2, w: 14 + i % 3 * 2 };
  }).filter(({ x }) => x < 378 * spread && Math.abs(x + 8 - 226 * spread) > 17);

  return <svg ref={svgRef} className="cc-starry-scene" viewBox={`0 0 ${canvasWidth} 112`} fill="none" focusable="false" aria-hidden="true">
    <defs>
      <radialGradient id={edgeId} cx="50%" cy="53%" r="60%">
        <stop offset="65%" stopColor="white" />
        <stop offset="100%" stopColor="black" />
      </radialGradient>
      <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#183961" /><stop offset=".58" stopColor="#173c68" />
        <stop offset="1" stopColor="#376d86" />
      </linearGradient>
      <radialGradient id={moonId}>
        <stop stopColor="#f5df8d" stopOpacity=".65" />
        <stop offset=".4" stopColor="#d7b85b" stopOpacity=".2" />
        <stop offset="1" stopColor="#d7b85b" stopOpacity="0" />
      </radialGradient>
      <mask id={maskId}>
        <path d="M8 58C4 38 24 26 45 22C78 5 110 13 140 10C180 3 206 14 239 9C276 3 305 14 337 8C370 5 396 12 420 23C446 29 460 48 451 68C457 88 430 97 400 98C370 111 340 102 306 107C268 112 239 103 204 108C164 111 135 104 105 106C64 106 32 95 23 84C8 81 3 70 8 58Z"
          transform={`scale(${spread} 1)`} fill={`url(#${edgeId})`} />
      </mask>
    </defs>
    <g mask={`url(#${maskId})`} strokeLinecap="round" strokeLinejoin="round">
      <path fill={`url(#${skyId})`} d={`M0 0h${canvasWidth}v112H0Z`} />

      {/* Short, broken strokes are the texture of the sky, not a bitmap overlay. */}
      <g className="cc-starry-atmosphere">
        {Array.from({ length: Math.round(125 * spread) }, (_, i) => {
          const x = 13 + (i * 47.3) % (canvasWidth - 24);
          const y = 12 + (i * 17.7) % 69;
          return <path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)}q5 -2 10 -1`}
            stroke={skyColors[i % 5]} strokeWidth={.8 + i % 3 * .35} opacity={.14 + i % 4 * .06} />;
        })}
      </g>

      <g transform={`scale(${spread} 1)`}><g className="cc-starry-current">
        {Array.from({ length: 15 }, (_, i) => <path key={i}
          d={`M-12 ${45 + i * 1.5}C47 ${9 + i * 1.8} 89 ${78 + i * 1.3} 149 ${49 + i * 1.4}S235 ${11 + i * 1.5} 280 ${46 + i * 1.2}S380 ${79 + i} 470 ${35 + i * 1.4}`}
          stroke={skyColors[i % 5]} strokeWidth={i % 4 === 0 ? 2 : 1}
          strokeDasharray={`${4 + i % 5} ${2 + i % 3}`} opacity={i % 4 === 0 ? .7 : .4} />)}
      </g></g>
      <BrushSwirl x={222 * spread} y={43} rx={49 * spread} ry={21} />
      <BrushSwirl x={350 * spread} y={60} rx={37 * spread} ry={13} reverse />
      <BrushSwirl x={116 * spread} y={48} rx={24 * spread} ry={10} reverse />

      {stars.map(({ x, y, r }, i) => <g key={x} transform={`translate(${x * spread} ${y})`}>
        <g className={`cc-starry-star cc-starry-star-${i % 3}`}>
          <circle r={r * 3.2} fill={`url(#${moonId})`} />
          {[0, 1, 2].map(ring => <path key={ring}
            d={spiralStroke(0, 0, r * (1.3 + ring * .45), r * (1.15 + ring * .4), ring * 2)}
            stroke={ring === 1 ? '#f2db92' : '#c4b671'} strokeWidth="1.1"
            strokeDasharray="2.7 1.4" opacity={.72 - ring * .15} />)}
          <path d={`M${-r} 0q${r * .3} ${-r * 1.4} ${r} ${-r}q${r * 1.4} ${r * .3} ${r} ${r}q${-r * .3} ${r * 1.4} ${-r} ${r}q${-r * 1.4} ${-r * .3} ${-r} ${-r}Z`}
            fill="#f4d77f" />
          <path d={`M${-r * .5} ${-r * .3}l${r * .8} ${-r * .15}`} stroke="#fff0bb" strokeWidth="1.8" />
        </g>
      </g>)}

      <g transform={`translate(${402 * spread} 29)`}>
        <g className="cc-starry-moon">
          <circle r="26" fill={`url(#${moonId})`} />
          {[15, 18, 21].map((r, i) => <circle key={r} r={r} stroke={i === 1 ? '#e3ca80' : '#91a29a'}
            strokeWidth="1.2" strokeDasharray="3 2" opacity={.65 - i * .12} />)}
          <path d="M7-12C-13-20-22 5-7 13C1 17 10 12 13 5C3 10-7 1 7-12Z" fill="#efd278" />
          <path d="M-4-10C-13-6-14 4-7 9" stroke="#fff0ba" strokeWidth="2" />
        </g>
      </g>
      <g transform={`translate(${267 * (spread - 1)} 0)`}><g className="cc-starry-comet" stroke="#f0d78f">
        <path d="M267 11l-19-4" opacity=".2" /><path d="M267 11l-10-2" opacity=".65" />
        <circle cx="267" cy="11" r="1.1" fill="#fff0bb" stroke="none" />
      </g></g>

      {/* The hills and village use the same broken, directional brushwork. */}
      <g className="cc-starry-hills" transform={`scale(${spread} 1)`}>
        <path d="M0 84Q35 64 65 76T128 72T194 79T257 67T331 78T403 69T465 77V112H0Z" fill="#244f66" />
        {Array.from({ length: 9 }, (_, i) => <path key={i}
          d={`M-5 ${85 + i * 2}Q35 ${66 + i * 2} 66 ${78 + i * 2}T128 ${74 + i * 2}T194 ${81 + i * 2}T257 ${69 + i * 2}T331 ${80 + i * 2}T403 ${71 + i * 2}T465 ${79 + i * 2}`}
          stroke={['#668b82', '#84a29a', '#173b55'][i % 3]} strokeWidth="1.5" strokeDasharray="7 3" opacity=".55" />)}
      </g>
      <path d="M0 103Q90 85 155 96T270 96T370 91T460 101V112H0Z" transform={`scale(${spread} 1)`} fill="#193b4d" />
      <g stroke="#8ba49b" strokeWidth=".75">
        {houses.map(({ x, y, w }, i) => <g key={x}>
          <path d={`M${x} ${y}h${w}v14h-${w}Z`} fill={i % 2 ? '#285269' : '#426675'} />
          <path d={`M${x - 2} ${y}l${w / 2 + 2} -7l${w / 2 + 2} 7Z`} fill={i % 2 ? '#152e43' : '#203e55'} />
          <g className={`cc-starry-windows cc-starry-windows-${i % 3}`} stroke="none" fill="#e0c77b">
            <path d={`M${x + 4} ${y + 4}h3v4h-3Zm${w - 9} 0h3v4h-3Z`} />
          </g>
          <path d={`M${x + w / 2 - 2} ${y + 9}h4v5h-4`} stroke="#142d3e" fill="#142d3e" />
        </g>)}
        <g transform={`translate(${226 * (spread - 1)} 0)`}>
        <path d="M218 102V81h15v21m-19-21 12-9 12 9Z" fill="#58767c" />
        <path d="M222 79V62h8v17m-10-17 6-17 6 17Z" fill="#224354" />
        <path d="M225 66h2v7h-2m-3 14h4v5h-4m6-5h3v5h-3" fill="#e0c77b" stroke="none" className="cc-starry-windows" />
        </g>
      </g>

      <g className="cc-starry-reflections" stroke="#d3c17f" strokeWidth=".8" opacity=".35">
        {Array.from({ length: Math.round(23 * spread) }, (_, i) => <path key={i}
          d={`M${102 * spread + i * 12} ${104 + i % 3 * 2}h${4 + i % 5}`} />)}
      </g>
      <g transform={`translate(${56 * (spread - 1)} 0)`}><g className="cc-starry-cypress">
        <path d="M49 113C44 99 53 95 44 85C36 74 45 65 45 55C43 44 55 34 56 15C63 30 60 36 66 46C72 57 64 62 72 74C80 88 70 96 81 112Z" fill="#112c35" />
        <path d="M59 110C57 94 67 96 60 81C54 70 57 64 54 57C49 45 58 33 56 22M69 107C63 94 71 87 64 76C60 69 67 59 60 49M49 102C56 88 44 84 49 73C54 63 47 59 50 50"
          stroke="#355348" strokeWidth="2.2" />
        <path d="M56 105C51 94 58 90 54 83M63 100C57 87 63 86 57 72M54 68C50 58 56 51 56 41M70 108l-2-12"
          stroke="#6b7550" strokeWidth="1.2" strokeDasharray="4 2" opacity=".6" />
      </g></g>
    </g>
  </svg>;
}

export default React.memo(StarryNightScene);
