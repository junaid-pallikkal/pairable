import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { IconButton } from './ui'
import { useToast } from './Toast'

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const BARS = 21 // odd, so there is a centre bar
const IDLE = Array<number>(BARS).fill(0.1)

/**
 * Live voice levels from the microphone: loud sounds make tall bars, and the pitch shows across the wave
 * (deep tones at the edges, high tones in the middle). Falls back to a gentle pulse if the mic cannot be read.
 */
function useVoiceLevels(active: boolean): { levels: number[]; live: boolean } {
  const [levels, setLevels] = useState<number[]>(IDLE)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!active) {
      setLevels(IDLE)
      setLive(false)
      return
    }
    let raf = 0
    let alive = true
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let last = 0

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.7
        ctx.createMediaStreamSource(s).connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const half = (BARS - 1) / 2
        setLive(true)

        const tick = (t: number) => {
          raf = requestAnimationFrame(tick)
          if (t - last < 33) return // about 30 frames a second is plenty
          last = t
          analyser.getByteFrequencyData(data)
          // human voice sits roughly in the first 60 of 128 bins
          const usable = 60
          const next = new Array<number>(BARS)
          for (let i = 0; i <= half; i++) {
            // centre bar = highest pitch bin range, edges = lowest
            const bin = Math.floor(((half - i) / half) * (usable - 1))
            const v = Math.min(1, Math.max(0.1, (data[bin] / 255) * 1.35))
            next[i] = v
            next[BARS - 1 - i] = v
          }
          setLevels(next)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(() => setLive(false))

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [active])

  return { levels, live }
}

/** English voice input using the browser's own speech recognition. Hidden when unsupported. */
export function MicButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  const toast = useToast()
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const supported = typeof window !== 'undefined' && !!getCtor()
  const { levels, live } = useVoiceLevels(listening)

  useEffect(() => () => rec.current?.stop(), [])
  if (!supported) return null

  function toggle() {
    if (listening) {
      rec.current?.stop()
      return
    }
    const Ctor = getCtor()!
    const r = new Ctor()
    r.lang = 'en-IN'
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const parts: string[] = []
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript)
      const t = parts.join(' ').trim()
      if (t) onText(t)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        toast.error('Microphone is blocked. Allow it in your browser, or type instead.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error("Couldn't hear you. Please try again.")
    }
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <span className="relative inline-flex">
      {listening && (
        <span
          role="status"
          aria-label="Listening"
          className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 flex h-12 items-center gap-3 rounded-full bg-fg px-4 shadow-float"
        >
          <span className="flex h-8 items-center gap-[3px]" aria-hidden>
            {levels.map((v, i) => (
              <span
                key={i}
                className={`w-[3px] rounded-full bg-accent ${live ? '' : 'animate-[pulse-soft_1s_ease-in-out_infinite]'}`}
                style={{ height: `${Math.round((live ? v : 0.35 + 0.4 * Math.abs(Math.sin(i))) * 100)}%`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </span>
          <span className="text-xs font-semibold text-white">Listening…</span>
        </span>
      )}
      <IconButton
        type="button"
        icon={listening ? Square : Mic}
        label={listening ? 'Stop listening' : 'Speak'}
        aria-pressed={listening}
        className={`${listening ? 'bg-accent text-black' : ''} ${className}`}
        onClick={toggle}
      />
    </span>
  )
}
