'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mic, PanelLeft, PanelRight } from 'lucide-react'
import ChatWindow from '@/components/ChatWindow'
import { ArticulateLogo } from '@/components/ArticulateLogo'
import MathInput from '@/components/MathInput'
import { SessionHistoryRail } from '@/components/session/SessionHistoryRail'
import { SessionStudyRail } from '@/components/session/SessionStudyRail'
import { SourceViewer } from '@/components/session/SourceViewer'
import { ProgressBars } from '@/components/session/ProgressBars'
import type { Message, Phase, MessageCitation } from '@/lib/session-store'
import type { ProgressState } from '@/lib/progress-evaluator'

type SessionPageProps = {
  params: Promise<{ id: string }>
}

export default function SessionPage({ params }: SessionPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [phase, setPhase] = useState<Phase>('recognition')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestsWrittenInput, setRequestsWrittenInput] = useState(false)
  const [writtenInputPrompt, setWrittenInputPrompt] = useState('')
  const [sessionComplete, setSessionComplete] = useState(false)
  const [error, setError] = useState('')
  const [voiceState, setVoiceState] = useState<'idle' | 'preparing' | 'recording' | 'processing'>('idle')
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  // ── Practice-mode-only state ───────────────────────────────────────────────
  const [sessionMode, setSessionMode] = useState<'practice' | 'evaluation' | 'brainstorming'>('practice')
  const [courseId, setCourseId] = useState<string | null>(null)
  const [, setCalibrationVersionId] = useState<string | null>(null)
  const [activeCitation, setActiveCitation] = useState<MessageCitation | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  // Whether to show SourceViewer vs SessionStudyRail in the right panel
  const isPracticeWithCourse = sessionMode === 'practice' && !!courseId

  const inputRef = useRef<HTMLInputElement>(null)
  const isRecordingRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function loadSession() {
      const res = await fetch(`/api/session/${id}/feedback`)
      if (!res.ok) return
      const data = await res.json() as { history?: Message[]; phase?: Phase }
      if (data.history?.length) {
        setMessages(data.history)
        const history = data.history
        if (history.length === 1 && history[0].role === 'articulate') {
          speakResponse(history[0].content, 0)
        }
      }
      if (data.phase && data.phase !== 'complete') {
        setPhase(data.phase)
      }

      // Load progress/mode for course-linked sessions
      const progRes = await fetch(`/api/session/${id}/progress`)
      if (progRes.ok) {
        const progData = await progRes.json() as {
          mode: 'practice' | 'evaluation' | 'brainstorming'
          courseId: string | null
          calibrationVersionId: string | null
          progress: ProgressState | null
        }
        setSessionMode(progData.mode)
        setCourseId(progData.courseId)
        setCalibrationVersionId(progData.calibrationVersionId)
        setProgress(progData.progress)
      }
    }
    loadSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Poll for progress updates in practice mode (async evaluator may update after response)
  useEffect(() => {
    if (!isPracticeWithCourse) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/session/${id}/progress`)
      if (res.ok) {
        const data = await res.json() as { progress: ProgressState | null }
        if (data.progress) setProgress(data.progress)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [id, isPracticeWithCourse])

  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const speakAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      speakAbortRef.current?.abort()
      activeAudioRef.current?.pause()
    }
  }, [])

  async function speakResponse(text: string, idx: number) {
    speakAbortRef.current?.abort()
    activeAudioRef.current?.pause()
    activeAudioRef.current = null

    const controller = new AbortController()
    speakAbortRef.current = controller
    setSpeakingIdx(idx)

    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body || controller.signal.aborted) {
        setSpeakingIdx(null)
        return
      }

      const blob = await res.blob()
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      activeAudioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); setSpeakingIdx(null) }
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeakingIdx(null) }
      audio.play().catch(() => setSpeakingIdx(null))
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') setSpeakingIdx(null)
    }
  }

  async function startRecording() {
    if (isRecordingRef.current) return
    isRecordingRef.current = true
    setVoiceState('preparing')
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''].find(
        t => !t || MediaRecorder.isTypeSupported(t)
      ) ?? ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      recordingChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data)
      }

      recorder.start(100)
      setVoiceState('recording')
    } catch (err) {
      console.error('[startRecording]', err)
      isRecordingRef.current = false
      setVoiceState('idle')
      setError('Could not access microphone. Check browser permissions.')
    }
  }

  async function stopRecording() {
    if (!isRecordingRef.current) return
    isRecordingRef.current = false
    setVoiceState('processing')

    const recorder = mediaRecorderRef.current
    const stream = streamRef.current
    mediaRecorderRef.current = null
    streamRef.current = null

    if (!recorder) {
      setVoiceState('idle')
      return
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    stream?.getTracks().forEach(t => t.stop())

    const blobs = recordingChunksRef.current
    recordingChunksRef.current = []

    if (!blobs.length) {
      setError('No audio captured. Try again.')
      setVoiceState('idle')
      return
    }

    try {
      const blob = new Blob(blobs, { type: recorder.mimeType || 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()

      const decodeCtx = new AudioContext()
      const decoded = await decodeCtx.decodeAudioData(arrayBuffer)
      await decodeCtx.close()

      const nativeRate = decoded.sampleRate
      const sourceSamples = decoded.getChannelData(0)

      const TARGET_RATE = 16000
      let pcmData: Int16Array

      if (nativeRate === TARGET_RATE) {
        pcmData = new Int16Array(sourceSamples.length)
        for (let i = 0; i < sourceSamples.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(sourceSamples[i] * 32767)))
        }
      } else {
        const targetLen = Math.ceil(sourceSamples.length * TARGET_RATE / nativeRate)
        const offCtx = new OfflineAudioContext(1, targetLen, TARGET_RATE)
        const buf = offCtx.createBuffer(1, sourceSamples.length, nativeRate)
        buf.getChannelData(0).set(sourceSamples)
        const src = offCtx.createBufferSource()
        src.buffer = buf
        src.connect(offCtx.destination)
        src.start()
        const rendered = await offCtx.startRendering()
        const rf32 = rendered.getChannelData(0)
        pcmData = new Int16Array(rf32.length)
        for (let i = 0; i < rf32.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(rf32[i] * 32767)))
        }
      }

      const form = new FormData()
      form.append('audio', new Blob([pcmData.buffer as ArrayBuffer], { type: 'audio/pcm' }), 'audio.pcm')
      form.append('sample_rate', String(TARGET_RATE))
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form })
      const data = await res.json() as { transcript?: string }
      if (data.transcript?.trim()) {
        await sendMessage(data.transcript.trim())
      } else if (!data.transcript && res.ok) {
        setError('No speech detected. Please try again.')
      } else {
        setError('Could not transcribe audio. Please try again.')
      }
    } catch (err) {
      console.error('[stopRecording]', err)
      setError('Could not transcribe audio. Please try again.')
    } finally {
      setVoiceState('idle')
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    setError('')
    setLoading(true)

    const newMessages: Message[] = [...messages, { role: 'student', content }]
    setMessages(newMessages)
    setInput('')
    setRequestsWrittenInput(false)

    try {
      const res = await fetch(`/api/session/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })
      const data = await res.json() as {
        message: string
        requestsWrittenInput?: boolean
        writtenInputPrompt?: string
        phase: Phase
        sessionComplete: boolean
        citations?: MessageCitation[]
        error?: string
      }

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      const nextMessage: Message = {
        role: 'articulate',
        content: data.message,
        // ── Practice mode only: attach citations ──────────────────────────────
        ...(isPracticeWithCourse && data.citations?.length ? { citations: data.citations } : {}),
      }
      const nextMessages = [...newMessages, nextMessage]
      setMessages(nextMessages)
      setPhase(data.phase)
      setRequestsWrittenInput(data.requestsWrittenInput ?? false)
      setWrittenInputPrompt(data.writtenInputPrompt ?? '')
      speakResponse(data.message, nextMessages.length - 1)

      if (data.sessionComplete) {
        setSessionComplete(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function endSession() {
    setLoading(true)
    try {
      const res = await fetch(`/api/session/${id}/feedback`, { method: 'POST' })
      if (res.ok) {
        router.push(`/feedback/${id}`)
      }
    } catch {
      setError('Could not generate feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-col border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <ArticulateLogo href="/" size="sm" className="transition-opacity hover:opacity-90" />
            <button
              type="button"
              onClick={() => setLeftOpen(o => !o)}
              className="hidden lg:flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={leftOpen ? 'Hide history panel' : 'Show history panel'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/reflect"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Reflect
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRightOpen(o => !o)}
              className="hidden lg:flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={rightOpen ? 'Hide panel' : 'Show panel'}
            >
              <PanelRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={endSession}
              disabled={loading || messages.length < 2}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              End session & get feedback
            </button>
          </div>
        </div>

        {/* ── Progress bars: practice + course-linked only ─────────────────── */}
        {isPracticeWithCourse && (
          <ProgressBars phase={phase} progress={progress} />
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {leftOpen && (
          <div className="hidden h-full min-h-0 w-72 shrink-0 lg:block">
            <SessionHistoryRail currentSessionId={id} />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-x">
          <div className="min-h-0 flex-1 overflow-hidden bg-background">
            {/* ChatWindow receives citation click handler in practice+course mode */}
            <ChatWindow
              messages={messages}
              phase={phase}
              loading={loading}
              speakingIdx={speakingIdx}
              onCitationClick={isPracticeWithCourse ? setActiveCitation : undefined}
            />
          </div>

          <div className="shrink-0 space-y-3 border-t border-border bg-card px-4 py-4">
            {error && <p className="px-1 text-xs text-destructive">{error}</p>}

            {sessionComplete && (
              <div className="text-center">
                <p className="mb-2 text-sm text-muted-foreground">Session complete.</p>
                <button
                  type="button"
                  onClick={endSession}
                  disabled={loading}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Generating feedback…' : 'See feedback'}
                </button>
              </div>
            )}

            {!sessionComplete && (
              <>
                {requestsWrittenInput && (
                  <MathInput
                    prompt={writtenInputPrompt}
                    onSubmit={sendMessage}
                    disabled={loading}
                  />
                )}

                {!requestsWrittenInput && (
                  <form
                    onSubmit={(e: { preventDefault: () => void }) => {
                      e.preventDefault()
                      sendMessage(input)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      disabled={loading}
                      placeholder={loading ? 'Thinking…' : 'Your answer…'}
                      autoFocus
                      className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => voiceState === 'recording' ? stopRecording() : startRecording()}
                      disabled={loading || voiceState === 'processing' || voiceState === 'preparing'}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        voiceState === 'recording'
                          ? 'bg-primary text-primary-foreground animate-pulse'
                          : voiceState === 'preparing'
                          ? 'border border-border text-muted-foreground opacity-60'
                          : 'border border-border text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Voice input"
                      aria-pressed={voiceState === 'recording'}
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Send
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right panel: SourceViewer (practice+course) or StudyRail (other) ── */}
        {rightOpen && (
          <div className="hidden h-full min-h-0 w-72 shrink-0 lg:block">
            {isPracticeWithCourse ? (
              <SourceViewer
                citation={activeCitation}
                onClose={() => setActiveCitation(null)}
              />
            ) : (
              <SessionStudyRail />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
