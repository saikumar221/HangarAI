import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { ChatItem, Phase } from '../types/brainstorm'

interface Props {
  title: string
  sessionId: string | null
  items: ChatItem[]
  phase: Phase
  isLoading: boolean
  onSendMessage: (message: string) => void
  onExport: () => void
  onClear: () => void
}

export default function ChatArea({
  title,
  sessionId,
  items,
  isLoading,
  onSendMessage,
  onExport,
  onClear,
}: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items, isLoading])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading || !sessionId) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !!input.trim() && !isLoading && !!sessionId

  return (
    <div className="chat">
      <div className="chat-header">
        <div className="chat-title">{title}</div>
        <div className="header-right">
          <div className="hlink" onClick={onClear}>Clear</div>
          <div className="export-btn" onClick={onExport}>Export manifest</div>
        </div>
      </div>

      <div className="messages">
        {!sessionId ? (
          <div className="empty-state">
            <div className="empty-text">
              Start a new session to begin brainstorming your startup idea.
            </div>
          </div>
        ) : (
          <>
            {items.map(item => {
              if (item.type === 'divider') {
                return (
                  <div key={item.id} className="divider-strip">
                    <div className="dline" />
                    <div className="dlabel">{item.label}</div>
                    <div className="dline" />
                  </div>
                )
              }

              return (
                <div key={item.id} className={`mrow ${item.role}${item.fade ? ' fade' : ''}`}>
                  <div className={`bubble ${item.role}${item.live ? ' live' : ''}`}>
                    {item.content}
                    {item.typing && <span className="cursor" />}
                    {item.captureCard && (
                      <div className="capture-card">
                        <div className="cc-label">{item.captureCard.label}</div>
                        <div className="cc-text">{item.captureCard.text}</div>
                        <div className="cc-chips">
                          {item.captureCard.chips.map((chip, i) => (
                            <div key={i} className={`cc-chip${chip.flag ? ' flag' : ''}`}>
                              {chip.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {isLoading && (
              <div className="mrow ai">
                <div className="bubble ai live">
                  <span className="cursor" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-wrap">
        <div className="input-box">
          <textarea
            ref={textareaRef}
            className="real-input"
            placeholder="Continue the thought..."
            value={input}
            rows={1}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !sessionId}
          />
          <div className="input-footer">
            <div className="input-hint">Return to send</div>
            <button className="send-btn" onClick={handleSend} disabled={!canSend}>
              <div className="send-arr" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
