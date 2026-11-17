import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

export type ScenePhase = 'analyzing' | 'discovering' | 'connecting' | 'ranked' | 'error'

const CX = 200
const CY = 140

function polar(r: number, i: number, n: number, offset = 0) {
  const a = (Math.PI * 2 * i) / Math.max(n, 1) - Math.PI / 2 + offset
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

/**
 * Every visual here comes from real data:
 * - skill nodes = the skills on the problem
 * - solver nodes = number of people the matching run actually returned (shown up to 12)
 * - lines are drawn only to returned matches; the top ones are emphasised
 */
export function MatchingScene({
  phase,
  skills,
  candidates,
  topCount = 3,
}: {
  phase: ScenePhase
  skills: string[]
  candidates: number
  topCount?: number
}) {
  const reduced = useReducedMotion()
  const shown = Math.min(candidates, 12)
  const showSkills = phase !== 'error'
  const showSolvers = phase === 'discovering' || phase === 'connecting' || phase === 'ranked'
  const showLines = phase === 'connecting' || phase === 'ranked'
  const dur = reduced ? 0 : 0.35

  const caption =
    phase === 'analyzing'
      ? 'Looking at what your problem needs…'
      : phase === 'discovering'
        ? `${candidates} possible ${candidates === 1 ? 'person' : 'people'} found`
        : phase === 'connecting'
          ? 'Checking who fits best…'
          : phase === 'ranked'
            ? candidates === 0
              ? 'No one fits yet'
              : `${candidates} ${candidates === 1 ? 'match' : 'matches'} ready`
            : "Couldn't finish matching"

  return (
    <figure className="mx-auto w-full max-w-md">
      <svg viewBox="0 0 400 280" role="img" aria-label={caption} className="h-auto w-full">
        {/* lines */}
        {showLines &&
          Array.from({ length: shown }).map((_, i) => {
            const p = polar(112, i, shown)
            const top = phase === 'ranked' && i < topCount
            return (
              <motion.line
                key={i}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke="var(--accent)"
                strokeWidth={top ? 2.5 : 1.2}
                strokeOpacity={phase === 'ranked' && !top ? 0.25 : 0.9}
                initial={{ pathLength: reduced ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: dur * 1.5, delay: reduced ? 0 : i * 0.04 }}
              />
            )
          })}

        {/* skills */}
        {showSkills &&
          skills.slice(0, 6).map((s, i, arr) => {
            const p = polar(62, i, arr.length, 0.4)
            return (
              <motion.g
                key={s}
                initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: dur, delay: reduced ? 0 : i * 0.08 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              >
                <circle cx={p.x} cy={p.y} r={7} fill="var(--accent-soft)" stroke="var(--accent)" />
                <text x={p.x} y={p.y + 20} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {s.length > 14 ? s.slice(0, 13) + '…' : s}
                </text>
              </motion.g>
            )
          })}

        {/* solvers */}
        {showSolvers &&
          Array.from({ length: shown }).map((_, i) => {
            const p = polar(112, i, shown)
            const top = phase === 'ranked' && i < topCount
            const dim = phase === 'ranked' && !top
            return (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={top ? 11 : 8}
                fill={top ? 'var(--primary)' : 'var(--accent)'}
                opacity={dim ? 0.35 : 1}
                initial={{ scale: reduced ? 1 : 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: dur, delay: reduced ? 0 : i * 0.05 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )
          })}
        {candidates > 12 && showSolvers && (
          <text x={CX} y={CY + 135} textAnchor="middle" fontSize="11" fill="var(--muted)">
            +{candidates - 12} more
          </text>
        )}

        {/* problem node */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={16}
          fill={phase === 'error' ? 'var(--danger)' : 'var(--primary)'}
          animate={phase === 'analyzing' && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={phase === 'analyzing' && !reduced ? { duration: 1.6, repeat: Infinity } : { duration: 0 }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
        <circle cx={CX} cy={CY} r={5} fill="var(--primary-fg)" />
      </svg>
      <figcaption className="text-center text-sm font-semibold text-muted" aria-live="polite">
        {caption}
      </figcaption>
    </figure>
  )
}

export type LifecycleState = 'sending' | 'pending' | 'accepted' | 'declined' | 'resolved' | 'idle'

/** Two nodes (you and them). The line only becomes solid after the server confirms acceptance. */
export function LifecycleScene({ state }: { state: LifecycleState }) {
  const reduced = useReducedMotion()
  const solid = state === 'accepted' || state === 'resolved'
  const faded = state === 'declined'
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-28 shrink-0" role="img" aria-label={`Status: ${state}`}>
      <motion.line
        x1={18}
        y1={20}
        x2={102}
        y2={20}
        stroke={solid ? 'var(--success)' : 'var(--muted)'}
        strokeWidth={solid ? 3 : 2}
        strokeDasharray={solid ? undefined : '5 5'}
        opacity={faded ? 0.25 : 1}
        animate={state === 'sending' && !reduced ? { strokeDashoffset: [0, -20] } : {}}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      <circle cx={14} cy={20} r={8} fill="var(--primary)" />
      <circle cx={106} cy={20} r={8} fill={faded ? 'var(--muted)' : 'var(--accent)'} opacity={faded ? 0.4 : 1} />
      {state === 'resolved' && (
        <g transform="translate(52 8)">
          <circle cx={8} cy={12} r={10} fill="var(--success)" />
          <Check x={2} y={6} size={12} color="#fff" />
        </g>
      )}
    </svg>
  )
}
