export type Phase = 'exploring' | 'challenging' | 'finalizing'

export interface SessionRecord {
  id: string
  title: string
  status: 'in_progress' | 'completed'
}

export interface Chip {
  text: string
  flag?: boolean
}

export interface CaptureCardData {
  label: string
  text: string
  chips: Chip[]
}

export interface ChatMessage {
  type: 'message'
  id: string
  role: 'ai' | 'user'
  content: string
  fade?: boolean
  live?: boolean
  typing?: boolean
  captureCard?: CaptureCardData
}

export interface Divider {
  type: 'divider'
  id: string
  label: string
}

export type ChatItem = ChatMessage | Divider
