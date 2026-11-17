import { useId } from 'react'

/**
 * Animated illustration: a grandmother tells a story, a parent holds up a phone, a child waves,
 * and a heart travels between them. Pure SVG + CSS (see index.css). Animations stop for reduced motion.
 */
export function StoryScene({ className = '' }: { className?: string }) {
  const u = useId().replace(/:/g, '')
  const heart = 'M0 -4 C-8 -13 -17 0 0 13 C17 0 8 -13 0 -4Z'
  const star = 'M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4Z'
  return (
    <svg viewBox="0 0 560 440" role="img" className={className} aria-label="A grandmother tells a story while a parent and child listen on a phone">
      <defs>
        <mask id={`moon-${u}`}>
          <rect x="400" y="20" width="140" height="100" fill="#fff" />
          <circle cx="484" cy="62" r="24" fill="#000" />
        </mask>
        <path id={`arc-${u}`} d="M204 240 C 250 112, 340 112, 384 244" />
      </defs>

      {/* soft backdrop */}
      <ellipse cx="280" cy="246" rx="262" ry="186" fill="#fff4cc" />
      <ellipse cx="280" cy="262" rx="200" ry="140" fill="#ffe9a0" opacity="0.55" />

      {/* moon and stars */}
      <circle cx="470" cy="68" r="30" fill="#fbbc15" mask={`url(#moon-${u})`} />
      {[[300, 44, 0], [60, 56, 0.8], [330, 96, 1.4], [528, 158, 0.4], [18, 170, 1.9]].map(([x, y, d]) => (
        <path key={`${x}-${y}`} d={star} transform={`translate(${x} ${y})`} fill="#fbbc15" className="sc-star" style={{ animationDelay: `${d}s`, transformOrigin: `${x}px ${y}px` }} />
      ))}

      {/* floor */}
      <rect x="12" y="378" width="536" height="14" rx="7" fill="#e6e1d6" />

      {/* ---------- grandmother in her armchair ---------- */}
      <rect x="36" y="150" width="200" height="232" rx="48" fill="#d9d4ca" />
      <rect x="22" y="252" width="46" height="112" rx="23" fill="#cdc6b8" />
      <rect x="204" y="252" width="46" height="112" rx="23" fill="#cdc6b8" />
      <rect x="26" y="302" width="220" height="78" rx="30" fill="#c4bdaf" />

      {/* body */}
      <rect x="88" y="214" width="104" height="120" rx="46" fill="#1a1a19" />
      <path d="M104 234 Q140 264 176 234" fill="none" stroke="#fbbc15" strokeWidth="6" strokeLinecap="round" />
      {/* arms */}
      <path d="M98 240 Q92 280 112 294" fill="none" stroke="#1a1a19" strokeWidth="22" strokeLinecap="round" />
      <path d="M182 240 Q188 280 168 294" fill="none" stroke="#1a1a19" strokeWidth="22" strokeLinecap="round" />
      {/* book */}
      <path d="M92 300 L140 290 L188 300 L188 342 L140 332 L92 342 Z" fill="#fbbc15" />
      <path d="M98 300 L140 292 L140 330 L98 338 Z" fill="#fff" />
      <g className="sc-page" style={{ transformOrigin: '140px 311px' }}>
        <path d="M140 292 L182 300 L182 338 L140 330 Z" fill="#fff" stroke="#ece7da" />
        <path d="M150 303 L174 308 M150 312 L174 317 M150 321 L174 326" stroke="#c9c3b5" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M106 303 L132 298 M106 312 L132 307 M106 321 L132 316" stroke="#c9c3b5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="112" cy="298" r="10" fill="#f0c8a0" />
      <circle cx="168" cy="298" r="10" fill="#f0c8a0" />

      {/* head */}
      <g className="sc-bob" style={{ transformOrigin: '140px 186px' }}>
        <circle cx="140" cy="186" r="36" fill="#f0c8a0" />
        <circle cx="140" cy="138" r="15" fill="#ebe9e3" />
        <path d="M104 186 Q102 142 140 142 Q178 142 176 186 Q168 160 140 160 Q112 160 104 186 Z" fill="#ebe9e3" />
        <circle cx="127" cy="190" r="9.5" fill="#fff" fillOpacity="0.3" stroke="#1a1a19" strokeWidth="2.5" />
        <circle cx="153" cy="190" r="9.5" fill="#fff" fillOpacity="0.3" stroke="#1a1a19" strokeWidth="2.5" />
        <path d="M136 190 L144 190" stroke="#1a1a19" strokeWidth="2.5" />
        <circle cx="127" cy="190" r="2.6" fill="#1a1a19" />
        <circle cx="153" cy="190" r="2.6" fill="#1a1a19" />
        <circle cx="117" cy="205" r="6" fill="#f08c85" opacity="0.45" />
        <circle cx="163" cy="205" r="6" fill="#f08c85" opacity="0.45" />
        <ellipse className="sc-mouth" cx="140" cy="208" rx="8" ry="5" fill="#8a3d3d" style={{ transformOrigin: '140px 208px' }} />
      </g>

      {/* speech bubble */}
      <g className="sc-bubble" style={{ transformOrigin: '150px 104px' }}>
        <rect x="62" y="40" width="196" height="58" rx="26" fill="#fff" stroke="#ece7da" />
        <path d="M118 96 L132 116 L150 97 Z" fill="#fff" stroke="#ece7da" />
        <rect x="116" y="94" width="36" height="6" fill="#fff" />
        <text x="160" y="76" textAnchor="middle" fontSize="19" fontWeight="700" fill="#0d0d0d" style={{ fontFamily: 'inherit' }}>
          Once upon a time…
        </text>
      </g>

      {/* ---------- the match: a heart travels from book to phone ---------- */}
      <use href={`#arc-${u}`} fill="none" stroke="#0d0d0d" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 11" className="sc-dash" />
      <path d={heart} fill="#fbbc15" stroke="#0d0d0d" strokeWidth="2">
        <animateMotion dur="4.2s" repeatCount="indefinite" rotate="0">
          <mpath href={`#arc-${u}`} />
        </animateMotion>
      </path>

      {/* ---------- parent with phone ---------- */}
      <rect x="382" y="320" width="19" height="60" rx="9" fill="#2a2a29" />
      <rect x="409" y="320" width="19" height="60" rx="9" fill="#2a2a29" />
      <rect x="372" y="234" width="64" height="98" rx="28" fill="#fbbc15" />
      <path d="M428 252 Q444 282 440 304" fill="none" stroke="#fbbc15" strokeWidth="18" strokeLinecap="round" />
      <circle cx="440" cy="308" r="8.5" fill="#d9a47c" />
      <g className="sc-bob" style={{ transformOrigin: '404px 206px', animationDelay: '-1s' }}>
        <circle cx="404" cy="206" r="27" fill="#d9a47c" />
        <path d="M377 204 Q376 174 404 174 Q432 174 431 204 Q420 189 404 189 Q388 189 377 204 Z" fill="#1a1a19" />
        <circle cx="394" cy="208" r="2.5" fill="#1a1a19" />
        <circle cx="414" cy="208" r="2.5" fill="#1a1a19" />
        <path d="M395 219 Q404 227 413 219" fill="none" stroke="#1a1a19" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="388" cy="217" r="5" fill="#f08c85" opacity="0.4" />
        <circle cx="420" cy="217" r="5" fill="#f08c85" opacity="0.4" />
      </g>
      <path d="M380 252 Q362 262 376 278" fill="none" stroke="#fbbc15" strokeWidth="18" strokeLinecap="round" />
      <g transform="rotate(-8 384 272)">
        <rect x="368" y="250" width="32" height="52" rx="8" fill="#0d0d0d" />
        <rect x="372" y="256" width="24" height="38" rx="4" fill="#fff4cc" />
        <path d={heart} fill="#fbbc15" stroke="#0d0d0d" strokeWidth="1.5" transform="translate(384 275) scale(0.8)" className="sc-pulse" style={{ transformOrigin: '384px 275px' }} />
      </g>
      <circle cx="376" cy="280" r="8" fill="#d9a47c" />

      {/* ---------- child ---------- */}
      <rect x="470" y="338" width="13" height="42" rx="6" fill="#2a2a29" />
      <rect x="490" y="338" width="13" height="42" rx="6" fill="#2a2a29" />
      <rect x="464" y="292" width="46" height="56" rx="20" fill="#0d0d0d" />
      <path d="M476 322 L498 322" stroke="#fbbc15" strokeWidth="5" strokeLinecap="round" />
      <path d="M504 308 Q514 326 510 336" fill="none" stroke="#0d0d0d" strokeWidth="13" strokeLinecap="round" />
      <g className="sc-wave" style={{ transformOrigin: '470px 304px' }}>
        <path d="M470 304 Q452 296 450 274" fill="none" stroke="#0d0d0d" strokeWidth="13" strokeLinecap="round" />
        <circle cx="450" cy="269" r="7.5" fill="#e0b08a" />
      </g>
      <g className="sc-bob" style={{ transformOrigin: '487px 272px', animationDelay: '-2s' }}>
        <circle cx="487" cy="272" r="21" fill="#e0b08a" />
        <path d="M466 270 Q466 248 487 248 Q508 248 508 270 Q498 258 487 258 Q476 258 466 270 Z" fill="#1a1a19" />
        <circle cx="464" cy="274" r="8" fill="#1a1a19" />
        <circle cx="510" cy="274" r="8" fill="#1a1a19" />
        <circle cx="479" cy="276" r="2.3" fill="#1a1a19" />
        <circle cx="495" cy="276" r="2.3" fill="#1a1a19" />
        <path d="M480 284 Q487 291 494 284" fill="none" stroke="#1a1a19" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* hearts floating up from the child */}
      {[[448, 232, 0], [500, 226, 1.3], [470, 210, 2.5]].map(([x, y, d]) => (
        <path key={`${x}-${d}`} d={heart} transform={`translate(${x} ${y}) scale(0.6)`} fill="#fbbc15" className="sc-heart" style={{ animationDelay: `${d}s` }} />
      ))}
    </svg>
  )
}
