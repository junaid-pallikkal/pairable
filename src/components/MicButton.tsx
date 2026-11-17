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

/** English voice input using the browser's own speech recognition. Hidden when the browser does not support it. */
export function MicButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  const toast = useToast()
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const supported = typeof window !== 'undefined' && !!getCtor()

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
    <IconButton
      type="button"
      icon={listening ? Square : Mic}
      label={listening ? 'Stop listening' : 'Speak'}
      aria-pressed={listening}
      className={`${listening ? 'bg-accent text-black' : ''} ${className}`}
      onClick={toggle}
    />
  )
}
