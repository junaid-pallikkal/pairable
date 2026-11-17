import { useId } from 'react'

/**
 * Pip, the RePair bot. Pure SVG with gradients, highlights and CSS animation so it reads as a soft 3D toy:
 * it floats, blinks, and waves its right hand. Animations stop automatically for reduced motion
 * (see src/index.css).
 */
export function Mascot({ className = '', waving = true, label = 'Pip the RePair bot, waving hello' }: { className?: string; waving?: boolean; label?: string }) {
  const u = useId().replace(/:/g, '')
  const g = (n: string) => `${n}-${u}`
  return (
    <svg viewBox="0 0 320 400" role="img" aria-label={label} className={className}>
      <defs>
        <radialGradient id={g('head')} cx="32%" cy="22%" r="85%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f1f1ee" />
          <stop offset="1" stopColor="#cfcfc9" />
        </radialGradient>
        <radialGradient id={g('body')} cx="30%" cy="18%" r="90%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ececE8" />
          <stop offset="1" stopColor="#bdbdb6" />
        </radialGradient>
        <linearGradient id={g('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2b2a" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <radialGradient id={g('eye')} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.5" stopColor="#fbbc15" />
          <stop offset="1" stopColor="#e39a00" />
        </radialGradient>
        <radialGradient id={g('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fbbc15" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fbbc15" stopOpacity="0" />
        </radialGradient>
        <filter id={g('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={g('blur2')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse className="bot-shadow" cx="160" cy="372" rx="78" ry="12" fill="#000" opacity="0.22" filter={`url(#${g('soft')})`} />

      <g className="bot-float">
        {/* hover glow under the body */}
        <ellipse className="bot-glow" cx="160" cy="338" rx="50" ry="14" fill={`url(#${g('glow')})`} />
        <path d="M128 322 Q160 350 192 322 Z" fill="#2a2a29" />

        {/* left arm (relaxed) */}
        <g>
          <path d="M104 226 Q70 246 74 290" fill="none" stroke={`url(#${g('body')})`} strokeWidth="26" strokeLinecap="round" />
          <path d="M104 226 Q70 246 74 290" fill="none" stroke="#000" strokeOpacity="0.06" strokeWidth="26" strokeLinecap="round" transform="translate(3 3)" />
          <circle cx="74" cy="296" r="19" fill={`url(#${g('body')})`} />
          <ellipse cx="68" cy="289" rx="7" ry="5" fill="#fff" opacity="0.8" />
        </g>

        {/* torso */}
        <rect x="102" y="196" width="116" height="132" rx="52" fill={`url(#${g('body')})`} />
        <ellipse cx="136" cy="226" rx="20" ry="11" fill="#fff" opacity="0.75" transform="rotate(-24 136 226)" />
        {/* chest panel */}
        <rect x="132" y="250" width="56" height="40" rx="14" fill={`url(#${g('visor')})`} />
        <circle cx="160" cy="270" r="9" fill={`url(#${g('eye')})`} />
        <circle cx="160" cy="270" r="15" fill={`url(#${g('glow')})`} className="bot-glow" />
        <path d="M156 270 l3 3 l6 -7" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

        {/* neck */}
        <rect x="140" y="188" width="40" height="22" rx="10" fill="#2a2a29" />

        {/* waving right arm */}
        <g className={waving ? 'bot-wave' : ''} style={{ transformOrigin: '214px 226px' }}>
          <path d="M214 228 Q262 214 270 160" fill="none" stroke={`url(#${g('body')})`} strokeWidth="26" strokeLinecap="round" />
          <path d="M214 228 Q262 214 270 160" fill="none" stroke="#000" strokeOpacity="0.06" strokeWidth="26" strokeLinecap="round" transform="translate(3 3)" />
          {/* hand */}
          <g className={waving ? 'bot-hand' : ''} style={{ transformOrigin: '270px 150px' }}>
            <circle cx="270" cy="146" r="24" fill={`url(#${g('body')})`} />
            <circle cx="252" cy="126" r="8" fill={`url(#${g('body')})`} />
            <circle cx="268" cy="120" r="8.5" fill={`url(#${g('body')})`} />
            <circle cx="285" cy="124" r="8" fill={`url(#${g('body')})`} />
            <ellipse cx="262" cy="140" rx="9" ry="6" fill="#fff" opacity="0.85" transform="rotate(-30 262 140)" />
          </g>
        </g>

        {/* ears */}
        <circle cx="68" cy="128" r="17" fill="#2a2a29" />
        <circle cx="68" cy="128" r="9" fill={`url(#${g('eye')})`} />
        <circle cx="252" cy="128" r="17" fill="#2a2a29" />
        <circle cx="252" cy="128" r="9" fill={`url(#${g('eye')})`} />

        {/* antenna */}
        <path d="M160 62 L160 34" stroke="#2a2a29" strokeWidth="6" strokeLinecap="round" />
        <circle className="bot-glow" cx="160" cy="28" r="20" fill={`url(#${g('glow')})`} />
        <circle cx="160" cy="28" r="9" fill={`url(#${g('eye')})`} />

        {/* head */}
        <rect x="70" y="58" width="180" height="144" rx="64" fill={`url(#${g('head')})`} />
        <rect x="70" y="58" width="180" height="144" rx="64" fill="none" stroke="#000" strokeOpacity="0.06" strokeWidth="2" />
        <ellipse cx="116" cy="82" rx="34" ry="14" fill="#fff" opacity="0.9" transform="rotate(-22 116 82)" filter={`url(#${g('blur2')})`} />

        {/* visor */}
        <rect x="92" y="92" width="136" height="76" rx="36" fill={`url(#${g('visor')})`} />
        <path d="M110 106 Q160 92 210 106" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="5" strokeLinecap="round" />
        {/* eyes */}
        <g className="bot-blink" style={{ transformOrigin: '160px 128px' }}>
          <ellipse cx="132" cy="128" rx="13" ry="16" fill={`url(#${g('eye')})`} />
          <ellipse cx="188" cy="128" rx="13" ry="16" fill={`url(#${g('eye')})`} />
          <ellipse cx="128" cy="121" rx="4" ry="5" fill="#fff" opacity="0.85" />
          <ellipse cx="184" cy="121" rx="4" ry="5" fill="#fff" opacity="0.85" />
        </g>
        {/* smile */}
        <path d="M146 150 Q160 162 174 150" fill="none" stroke="#fbbc15" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Small round bot face for logos and the chat launcher. */
export function BotHead({ size = 32, className = '' }: { size?: number; className?: string }) {
  const u = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={className}>
      <defs>
        <radialGradient id={`h-${u}`} cx="32%" cy="22%" r="85%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d4d4ce" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="5" r="3" fill="#fbbc15" />
      <rect x="23" y="7" width="2" height="5" fill="#2a2a29" />
      <rect x="5" y="11" width="38" height="31" rx="14" fill={`url(#h-${u})`} />
      <rect x="10" y="17" width="28" height="18" rx="9" fill="#0d0d0d" />
      <ellipse cx="18" cy="26" rx="3.2" ry="4" fill="#fbbc15" />
      <ellipse cx="30" cy="26" rx="3.2" ry="4" fill="#fbbc15" />
    </svg>
  )
}
