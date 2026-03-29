import { useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import { createSession, sendMessage, finalizeSession } from '../api/brainstorm'
import type { SessionRecord, ChatItem, Phase } from '../types/brainstorm'

const SESSIONS_KEY = 'hangar_sessions'

function loadStored(): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') }
  catch { return [] }
}

function persist(sessions: SessionRecord[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export default function BrainstormPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>(loadStored)
  const [activeId, setActiveId] = useState<string | null>(
    () => loadStored().find(s => s.status === 'in_progress')?.id ?? null,
  )
  const [items, setItems] = useState<ChatItem[]>([])
  const [phase, setPhase] = useState<Phase>('exploring')
  const [isLoading, setIsLoading] = useState(false)

  const patchSession = useCallback((id: string, patch: Partial<SessionRecord>) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...patch } : s)
      persist(next)
      return next
    })
  }, [])

  const handleNewSession = useCallback(async () => {
    try {
      const session = await createSession()
      const record: SessionRecord = { id: session.id, title: 'New session', status: 'in_progress' }
      setSessions(prev => { const next = [record, ...prev]; persist(next); return next })
      setActiveId(session.id)
      setPhase('exploring')
      setItems([{
        type: 'message',
        id: crypto.randomUUID(),
        role: 'ai',
        content: "What problem are you actually trying to solve — not the product, the underlying friction?",
        live: true,
      }])
    } catch (err) {
      console.error('Failed to create session', err)
    }
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    if (id === activeId) return
    setActiveId(id)
    setItems([])
    setPhase('exploring')
  }, [activeId])

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeId || isLoading) return

    const current = sessions.find(s => s.id === activeId)
    if (current?.title === 'New session') {
      patchSession(activeId, { title: text.length > 42 ? text.slice(0, 42) + '…' : text })
    }

    setItems(prev => [
      ...prev.map(item => item.type === 'message' ? { ...item, live: false, fade: true } : item),
      { type: 'message' as const, id: crypto.randomUUID(), role: 'user' as const, content: text, live: true },
    ])
    setIsLoading(true)

    try {
      const prevPhase = phase
      const { reply, phase: rawPhase } = await sendMessage(activeId, text)
      const newPhase = rawPhase as Phase

      setItems(prev => {
        const additions: ChatItem[] = []
        if (newPhase !== prevPhase) {
          additions.push({
            type: 'divider',
            id: crypto.randomUUID(),
            label: newPhase === 'challenging' ? 'Challenge phase' : 'Finalizing',
          })
        }
        additions.push({ type: 'message', id: crypto.randomUUID(), role: 'ai', content: reply, live: true })
        return [...prev, ...additions]
      })
      setPhase(newPhase)
    } catch (err) {
      console.error('Chat error', err)
      setItems(prev => [
        ...prev,
        { type: 'message' as const, id: crypto.randomUUID(), role: 'ai' as const, content: 'Something went wrong. Please try again.', live: true },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [activeId, isLoading, phase, sessions, patchSession])

  const handleExport = useCallback(async () => {
    if (!activeId || isLoading) return
    setIsLoading(true)
    try {
      const m = await finalizeSession(activeId)
      patchSession(activeId, { status: 'completed' })

      const chips = [
        m.target_customer && { text: m.target_customer },
        m.market_size && { text: m.market_size },
        (m.key_assumptions?.length ?? 0) > 0 && { text: `${m.key_assumptions!.length} key assumptions`, flag: true as const },
      ].filter(Boolean) as { text: string; flag?: true }[]

      setItems(prev => [
        ...prev,
        { type: 'divider', id: crypto.randomUUID(), label: 'Manifest exported' },
        {
          type: 'message', id: crypto.randomUUID(), role: 'ai', content: m.one_liner ?? 'Session finalized.', live: true,
          captureCard: {
            label: 'Captured in manifest',
            text: [m.problem, m.solution].filter(Boolean).join(' · ') || 'Manifest captured.',
            chips: chips.length > 0 ? chips : [{ text: 'Manifest captured' }],
          },
        },
      ])
      setPhase('finalizing')
    } catch (err) {
      console.error('Finalize error', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeId, isLoading, patchSession])

  const handleClear = useCallback(() => setItems([]), [])

  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <div className="hangar-root">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
      />
      <ChatArea
        title={activeSession?.title ?? 'HangarAI'}
        sessionId={activeId}
        items={items}
        phase={phase}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onExport={handleExport}
        onClear={handleClear}
      />
    </div>
  )
}
