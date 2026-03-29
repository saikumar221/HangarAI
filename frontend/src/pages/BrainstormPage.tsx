import { useState, useCallback, useEffect } from 'react'
import ChatArea from '../components/ChatArea'
import { createSession, sendMessage, finalizeSession, deleteSession, deleteManifest, getSessions, getMessages } from '../api/brainstorm'
import type { ChatItem, Phase } from '../types/brainstorm'

export default function BrainstormPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<ChatItem[]>([])
  const [phase, setPhase] = useState<Phase>('exploring')
  const [isLoading, setIsLoading] = useState(false)

  // On mount: load existing session or create one
  useEffect(() => {
    async function initSession() {
      try {
        const sessions = await getSessions()
        const existing = sessions.find(s => s.status === 'in_progress') ?? sessions[0] ?? null

        if (existing) {
          setSessionId(existing.id)
          const msgs = await getMessages(existing.id)
          const chatItems: ChatItem[] = msgs.map(m => ({
            type: 'message' as const,
            id: m.id,
            role: m.role === 'user' ? 'user' as const : 'ai' as const,
            content: m.content,
          }))
          setItems(chatItems)
        } else {
          const session = await createSession()
          setSessionId(session.id)
          setItems([{
            type: 'message',
            id: crypto.randomUUID(),
            role: 'ai',
            content: "What problem are you actually trying to solve — not the product, the underlying friction?",
            live: true,
          }])
        }
      } catch (err) {
        console.error('Failed to initialize session', err)
      }
    }
    initSession()
  }, [])

  const handleSendMessage = useCallback(async (text: string) => {
    if (!sessionId || isLoading) return

    setItems(prev => [
      ...prev.map(item => item.type === 'message' ? { ...item, live: false, fade: true } : item),
      { type: 'message' as const, id: crypto.randomUUID(), role: 'user' as const, content: text, live: true },
    ])
    setIsLoading(true)

    try {
      const prevPhase = phase
      const { reply, phase: rawPhase } = await sendMessage(sessionId, text)
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
  }, [sessionId, isLoading, phase])

  const handleExport = useCallback(async () => {
    if (!sessionId || isLoading) return
    setIsLoading(true)
    try {
      await finalizeSession(sessionId)

      setItems(prev => [
        ...prev,
        { type: 'divider', id: crypto.randomUUID(), label: 'Manifest ready' },
        {
          type: 'message', id: crypto.randomUUID(), role: 'ai',
          content: 'Your manifest has been generated. You can view and export it from the Manifest page.',
          live: true,
        },
      ])
      setPhase('finalizing')
    } catch (err) {
      console.error('Finalize error', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isLoading])

  const handleClear = useCallback(async () => {
    if (!sessionId) return
    try {
      await deleteSession(sessionId)
      await deleteManifest()
    } catch (err) {
      console.error('Failed to delete session', err)
    }
    // Create a fresh session after clearing
    try {
      const session = await createSession()
      setSessionId(session.id)
      setItems([{
        type: 'message',
        id: crypto.randomUUID(),
        role: 'ai',
        content: "What problem are you actually trying to solve — not the product, the underlying friction?",
        live: true,
      }])
      setPhase('exploring')
    } catch (err) {
      console.error('Failed to create new session after clear', err)
      setSessionId(null)
      setItems([])
      setPhase('exploring')
    }
  }, [sessionId])

  return (
    <div className="hangar-root">
      <ChatArea
        title="HangarAI"
        sessionId={sessionId}
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
